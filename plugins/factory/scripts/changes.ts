// Changes (ADR 0051): the route of each task that goes through the factory's stages, in docs/changes/<name>/task.md.
//
//   bun changes.ts check <task.md>      validates one task document; exits 1 with the problems when it's invalid
//   bun changes.ts status [projectDir]  the unfinished changes and where each one stopped
//   bun changes.ts reminder [projectDir] SessionStart hook output; prints nothing when no change is unfinished
//   bun changes.ts pr-body <change folder> [--base <branch>]
//                                       the change's pull request description (ADR 0056); --base is the branch it
//                                       merges into, `main` by default. Refuses, printing nothing, while a stage before
//                                       finish isn't done or a document fails its gate

import { lstat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { mapConcurrent } from "../../../lib/concurrency.ts";
import { readDir, readText, TEXT_BYTES_MAX, whenMissing } from "../../../lib/files.ts";
import { parseFrontmatter } from "../../../lib/frontmatter.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";
import type { Parsed } from "../../../lib/parse.ts";
import { parse } from "../../../lib/parse.ts";
import { requiredText } from "../../../lib/schemas.ts";
import { addedDecisionRecords } from "./decision-records.ts";
import { renderPrBody } from "./pr-body.ts";
import { resolveProjectDir } from "./project-dir.ts";
import { AUTONOMY_LEVELS } from "./settings.ts";
import {
    criteriaIds,
    intentProblems,
    planProblems,
    reviewProblems,
    sectionText,
    specProblems,
    spikeProblems,
    taskListProblems,
    unfinishedTaskProblems,
    verificationProblems,
} from "./stage-gates.ts";

/**
 * Every stage a route can contain, in the only order they may appear in: a route is a subset of this list, so its
 * gates are always in the same place (ADR 0051).
 */
export const STAGES = [
    "intent",
    "spec",
    "spike",
    "architecture",
    "migration-plan",
    "plan",
    "tasks",
    "build",
    "verify",
    "security-review",
    "review",
    "docs",
    "finish",
] as const;

/** One stage of a route. */
export type Stage = (typeof STAGES)[number];

/** The named starting points for a route; triage may deviate from them, with a recorded reason. */
export const TRACKS: Readonly<Record<"quick" | "standard" | "full", readonly Stage[]>> = {
    quick: ["build", "verify", "review"],
    standard: ["spec", "plan", "build", "review", "finish"],
    full: ["intent", "spec", "plan", "tasks", "build", "review", "docs", "finish"],
};

/** Stages whose content is the owner's to decide, so they always run at `guided` (ADR 0051). */
const OWNER_STAGES: readonly Stage[] = ["intent", "spec"];

const STATUSES = ["pending", "in-progress", "done", "skipped"] as const;
const TASK_TYPES = ["feature", "bug", "refactor", "chore", "docs", "spike"] as const;

const READS_IN_FLIGHT_MAX = 16; // change folders read at once at session start
const CHANGES_MAX = 10_000; // change folders in one project: years of daily work
const LIST_ITEMS_MAX = 20; // deviations or debt items per task; more means the route needs rethinking
const TEXT_LENGTH_MAX = 300;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Where a project keeps its changes, relative to the project folder. */
export const CHANGES_DIR = "docs/changes";

const StageEntrySchema = z.strictObject({
    name: z.enum(STAGES),
    level: z.enum(AUTONOMY_LEVELS),
    status: z.enum(STATUSES),
});

// Our own format, so strict: unknown keys are typos (ADR 0020).
const TaskDocumentSchema = z
    .strictObject({
        title: requiredText({ maxLength: 200 }),
        created: z.string().regex(DATE, "must be a date as YYYY-MM-DD"),
        track: z.enum(["quick", "standard", "full"]),
        classification: z.strictObject({
            type: z.enum(TASK_TYPES),
            size: z.enum(["small", "medium", "large"]),
            risk: z.enum(["low", "moderate", "high"]),
            reversible: z.boolean(),
            uncertainty: z.enum(["low", "high"]),
            architectureDebt: z.array(requiredText({ maxLength: TEXT_LENGTH_MAX })).max(LIST_ITEMS_MAX),
        }),
        stages: z.array(StageEntrySchema).min(1).max(STAGES.length),
        deviations: z.array(requiredText({ maxLength: TEXT_LENGTH_MAX })).max(LIST_ITEMS_MAX),
    })
    .superRefine(({ track, stages }, context) => {
        for (const problem of routeProblems(stages, { track })) {
            context.addIssue({ code: "custom", message: problem, path: ["stages"] });
        }
    });

/** A task's route document: the frontmatter of `docs/changes/<name>/task.md`. */
export type TaskDocument = Readonly<z.infer<typeof TaskDocumentSchema>>;

type StageEntry = Readonly<z.infer<typeof StageEntrySchema>>;

/** The invariants every route must keep, whatever its track or deviations. */
function routeProblems(stages: readonly StageEntry[], { track }: { readonly track: string }): string[] {
    const names = stages.map((stage) => stage.name);
    const positions = names.map((name) => STAGES.indexOf(name));
    const isInOrder = positions.every(isAfterPrevious);
    const firstPending = stages.findIndex((stage) => stage.status === "pending");
    const hasPending = firstPending !== -1;
    const isStartedAfterPending = hasPending && stages.slice(firstPending + 1).some(isStarted);
    const hasSeveralInProgress = stages.filter((stage) => stage.status === "in-progress").length > 1;
    const isQuick = track === "quick";
    const buildsWithoutPlan = names.includes("build") && !names.includes("plan") && !isQuick;
    const buildsWithoutReview = names.includes("build") && !names.includes("review");
    const endsWithoutFinish = !isQuick && names.at(-1) !== "finish";
    const ownerStagesRaised = stages
        .filter((stage) => OWNER_STAGES.includes(stage.name))
        .filter((stage) => stage.level !== "guided");

    return [
        isInOrder ? null : `stages must be unique and in this order: ${STAGES.join(", ")}`,
        hasSeveralInProgress ? "at most one stage can be in progress" : null,
        isStartedAfterPending ? "a stage can't be started or done while an earlier stage is still pending" : null,
        buildsWithoutPlan ? "a route that builds needs a plan first (except on the quick track)" : null,
        buildsWithoutReview ? "a route that builds needs a review" : null,
        endsWithoutFinish ? "the route must end with finish" : null,
        ...ownerStagesRaised.map((stage) => `${stage.name} is the owner's, so it always runs at guided`),
    ].filter((problem) => problem !== null);
}

/** `true` when a stage's position in `STAGES` comes after the previous stage's: the order holds and nothing repeats. */
const isAfterPrevious = (position: number, index: number, positions: readonly number[]): boolean =>
    index === 0 || position > (positions[index - 1] ?? -1);

const isStarted = (stage: StageEntry): boolean => stage.status === "in-progress" || stage.status === "done";

/**
 * Parses a task document's frontmatter, including the route's invariants: stages unique and in the fixed order,
 * at most one in progress, nothing started after a pending stage, a plan and a review around every build, `finish`
 * last, and `intent` and `spec` always at `guided`.
 *
 * @param frontmatter - The parsed frontmatter of a `task.md`, not yet trusted.
 * @returns The task document, or every problem found.
 *
 * @example
 * ```ts
 * const task = {
 *     title: "Export jobs as CSV",
 *     created: "2026-10-01",
 *     track: "standard",
 *     classification: {
 *         type: "feature", size: "medium", risk: "low", reversible: true, uncertainty: "low", architectureDebt: [],
 *     },
 *     stages: ["spec", "plan", "build", "review", "finish"].map((name) => ({ name, level: "guided", status: "pending" })),
 *     deviations: [],
 * };
 *
 * expect(parseTaskDocument(task).kind).toBe("valid");
 * expect(parseTaskDocument({ ...task, stages: task.stages.slice(0, 3) })).toEqual({
 *     kind: "invalid",
 *     errors: ["stages: a route that builds needs a review", "stages: the route must end with finish"],
 * });
 * ```
 */
export function parseTaskDocument(frontmatter: unknown): Parsed<TaskDocument> {
    return parse(TaskDocumentSchema, frontmatter);
}

/**
 * Where a route stands: the stage to resume, or `null` when every stage is done or skipped.
 *
 * @param stages - The route's stages.
 * @returns The stage in progress, else the first pending one, else `null`.
 *
 * @example
 * ```ts
 * const route = [
 *     { name: "spec", level: "guided", status: "done" },
 *     { name: "plan", level: "trusted", status: "pending" },
 * ] as const;
 *
 * expect(resumePoint(route)?.name).toBe("plan");
 * expect(resumePoint([{ name: "spec", level: "guided", status: "done" }])).toBeNull();
 * ```
 */
export function resumePoint(stages: readonly StageEntry[]): StageEntry | null {
    return (
        stages.find((stage) => stage.status === "in-progress") ??
        stages.find((stage) => stage.status === "pending") ??
        null
    );
}

/** The stage documents next to a change's `task.md`; `null` for a file that doesn't exist. */
export type StageDocuments = {
    readonly intent: string | null;
    readonly spec: string | null;
    readonly plan: string | null;
    readonly tasks: string | null;
    readonly verification: string | null;
    readonly spike: string | null;
    readonly review: string | null;
    readonly securityReview: string | null;
};

/**
 * Checks the documents of the stages marked done against their stage's gate (ADR 0052 to 0055): a stage can't be done
 * while its document is missing or incomplete, while the plan's tasks don't cover the spec, or, for the build, while
 * a task isn't done.
 *
 * @param task - The change's valid task document.
 * @param documents - The stage documents next to it.
 * @returns Every problem found; empty when every done stage passes its gate.
 *
 * @example
 * ```ts
 * const stages = [
 *     { name: "spec", level: "guided", status: "done" },
 *     { name: "plan", level: "trusted", status: "pending" },
 * ] as const;
 *
 * const none = {
 *     intent: null, spec: null, plan: null, tasks: null, verification: null, spike: null, review: null, securityReview: null,
 * };
 *
 * expect(gateProblems({ stages }, none)).toEqual([
 *     "spec is done, but spec.md is missing",
 * ]);
 * ```
 */
export function gateProblems(task: Pick<TaskDocument, "stages">, documents: StageDocuments): string[] {
    const hasStage = (name: Stage): boolean => task.stages.some((stage) => stage.name === name);
    const isDone = (name: Stage): boolean =>
        task.stages.some((stage) => stage.name === name && stage.status === "done");
    const needsProblem = !hasStage("intent");
    const hasTasksStage = hasStage("tasks");
    const criteria = documents.spec === null ? null : criteriaIds(documents.spec);
    const taskList = hasTasksStage ? documents.tasks : sectionText(documents.plan ?? "", "Tasks");
    const taskListFile = hasTasksStage ? "tasks.md" : "plan.md's Tasks section";
    // verification.md is required once the build or the verify stage is done; name the stage that asks for it.
    const verifiedBy = (["verify", "build"] as const).find(isDone) ?? null;
    const planWithTasks = (plan: string): string[] => [
        ...planProblems(plan, { hasTasksSection: !hasTasksStage }),
        ...(hasTasksStage ? [] : taskListProblems(sectionText(plan, "Tasks") ?? "", { file: taskListFile, criteria })),
    ];

    return [
        ...(isDone("intent") ? documentProblems(documents.intent, "intent", intentProblems) : []),
        ...(isDone("spec")
            ? documentProblems(documents.spec, "spec", (spec) => specProblems(spec, { needsProblem }))
            : []),
        ...(isDone("plan") ? documentProblems(documents.plan, "plan", planWithTasks) : []),
        ...(isDone("tasks")
            ? documentProblems(documents.tasks, "tasks", (tasks) =>
                  taskListProblems(tasks, { file: "tasks.md", criteria }),
              )
            : []),
        ...(isDone("spike") ? documentProblems(documents.spike, "spike", spikeProblems) : []),
        ...(isDone("security-review")
            ? documentProblems(documents.securityReview, "security-review", (review) =>
                  reviewProblems(review, { file: "security-review.md" }),
              )
            : []),
        ...(isDone("review")
            ? documentProblems(documents.review, "review", (review) => reviewProblems(review, { file: "review.md" }))
            : []),
        ...(isDone("build") && taskList !== null ? unfinishedTaskProblems(taskList, { file: taskListFile }) : []),
        ...(verifiedBy === null
            ? []
            : fileProblems(documents.verification, { file: "verification.md", stage: verifiedBy }, (verification) =>
                  verificationProblems(verification, { criteria }),
              )),
    ];
}

function documentProblems(markdown: string | null, stage: Stage, check: (markdown: string) => string[]): string[] {
    return markdown === null ? [`${stage} is done, but ${stage}.md is missing`] : check(markdown);
}

function fileProblems(
    markdown: string | null,
    { file, stage }: { readonly file: string; readonly stage: Stage },
    check: (markdown: string) => string[],
): string[] {
    return markdown === null ? [`${stage} is done, but ${file} is missing`] : check(markdown);
}

/** One change folder: its route, or why it couldn't be read. */
export type Change =
    | { readonly kind: "valid"; readonly name: string; readonly task: TaskDocument }
    | { readonly kind: "invalid"; readonly name: string; readonly errors: readonly string[] };

/**
 * Renders the unfinished changes as a markdown table, with the invalid ones listed below it.
 *
 * @param changes - Every change folder in the project.
 * @returns The table, or a sentence when no change is unfinished or invalid.
 *
 * @example
 * ```ts
 * const task = {
 *     title: "Export jobs as CSV", created: "2026-10-01", track: "standard", deviations: [],
 *     classification: { type: "feature", size: "medium", risk: "low", reversible: true, uncertainty: "low", architectureDebt: [] },
 *     stages: [
 *         { name: "spec", level: "guided", status: "done" },
 *         { name: "plan", level: "trusted", status: "in-progress" },
 *     ],
 * } as const;
 *
 * expect(changesStatus([{ kind: "valid", name: "2026-10-01-export-csv", task }])).toContain(
 *     "| 2026-10-01-export-csv | Export jobs as CSV | standard | plan (in-progress, trusted) |",
 * );
 * ```
 */
export function changesStatus(changes: readonly Change[]): string {
    const unfinished = changes.flatMap((change) => {
        const stage = change.kind === "valid" ? resumePoint(change.task.stages) : null;

        return change.kind === "valid" && stage !== null ? [{ name: change.name, task: change.task, stage }] : [];
    });
    const invalid = changes.flatMap((change) => (change.kind === "invalid" ? [change] : []));

    if (unfinished.length === 0 && invalid.length === 0) {
        return `No unfinished changes in \`${CHANGES_DIR}/\`.`;
    }

    const rows = unfinished.map(
        ({ name, task, stage }) =>
            `| ${name} | ${task.title} | ${task.track} | ${stage.name} (${stage.status}, ${stage.level}) |`,
    );
    const table =
        rows.length === 0 ? [] : ["| Change | Title | Track | Resume at |", "| --- | --- | --- | --- |", ...rows];
    const problems = invalid.map((change) => `- \`${change.name}\`: ${change.errors.join("; ")}`);

    return [...table, ...(problems.length === 0 ? [] : ["", "Invalid task documents:", ...problems])].join("\n");
}

/**
 * Builds the session-start reminder for unfinished changes, so an interrupted task is picked up instead of forgotten.
 *
 * @param changes - Every change folder in the project.
 * @returns The hook output, or `null` when nothing is unfinished or invalid.
 *
 * @example
 * ```ts
 * expect(changesReminder([])).toBeNull();
 * expect(changesReminder([{ kind: "invalid", name: "x", errors: ["no task.md"] }])?.systemMessage).toBe(
 *     "Changes: 0 unfinished, 1 with an invalid task.md. Run the factory's changes status for details.",
 * );
 * ```
 */
export function changesReminder(changes: readonly Change[]): {
    readonly systemMessage: string;
    readonly hookSpecificOutput: { readonly hookEventName: "SessionStart"; readonly additionalContext: string };
} | null {
    const unfinishedCount = changes.filter(
        (change) => change.kind === "valid" && resumePoint(change.task.stages) !== null,
    ).length;
    const invalidCount = changes.filter((change) => change.kind === "invalid").length;
    const hasNothingToReport = unfinishedCount === 0 && invalidCount === 0;

    if (hasNothingToReport) {
        return null;
    }

    return {
        systemMessage: `Changes: ${unfinishedCount} unfinished, ${invalidCount} with an invalid task.md. Run the factory's changes status for details.`,
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: [
                "## Unfinished changes (ADR 0051)",
                "",
                changesStatus(changes),
                "",
                `Mention these to the owner once, briefly, and offer to resume one: read its \`${CHANGES_DIR}/<change>/task.md\` and continue at its resume point, following the factory-triage skill. Don't resume without the owner's go-ahead.`,
            ].join("\n"),
        },
    };
}

/** A document of a change folder that is a symbolic link, which could lead outside the repository. */
class LinkedDocumentError extends Error {}

/**
 * Reads one document of a change folder, or null when it doesn't exist. The only way the change's documents are read:
 * it refuses a symbolic link (`lstat` doesn't follow it), because a committed link could point outside the repository
 * and its target would end up in a pull request description.
 */
async function readChangeDocument(
    changeDir: string,
    file: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<string | null> {
    const documentPath = path.join(changeDir, file);

    signal.throwIfAborted();

    const linked = await lstat(documentPath).then((stats) => stats.isSymbolicLink(), whenMissing(false));

    if (linked) {
        throw new LinkedDocumentError(
            `${CHANGES_DIR}/${path.basename(changeDir)}/${file} is a symbolic link: a change's documents must be regular files`,
        );
    }

    return readText(documentPath, { maxBytes: TEXT_BYTES_MAX, signal }).catch(whenMissing(null));
}

async function readTaskDocument(
    changeDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<Parsed<TaskDocument>> {
    const markdown = await readChangeDocument(changeDir, "task.md", { signal });

    if (markdown === null) {
        return { kind: "invalid", errors: [`has no task.md: ${path.join(changeDir, "task.md")} doesn't exist`] };
    }

    try {
        const frontmatter = parseFrontmatter(markdown);

        return frontmatter === null
            ? { kind: "invalid", errors: ["task.md must start with a YAML frontmatter block"] }
            : parseTaskDocument(frontmatter);
    } catch (error: unknown) {
        if (error instanceof SyntaxError) {
            return { kind: "invalid", errors: ["task.md's frontmatter is not valid YAML"] };
        }
        throw error;
    }
}

/**
 * A change's task document, with the gates of its done stages applied. `gates: "unfinished"` skips the gates of a
 * change whose every stage is done or skipped, so session start doesn't read the documents of the whole history.
 */
async function readChange(
    changeDir: string,
    options: { readonly gates: "always" | "unfinished"; readonly signal: AbortSignal },
): Promise<Parsed<TaskDocument>> {
    try {
        return await readChangeUnchecked(changeDir, options);
    } catch (error: unknown) {
        if (error instanceof LinkedDocumentError) {
            return { kind: "invalid", errors: [error.message] };
        }
        throw error;
    }
}

async function readChangeUnchecked(
    changeDir: string,
    { gates, signal }: { readonly gates: "always" | "unfinished"; readonly signal: AbortSignal },
): Promise<Parsed<TaskDocument>> {
    const task = await readTaskDocument(changeDir, { signal });

    if (task.kind === "invalid") {
        return task;
    }

    const isFinished = resumePoint(task.value.stages) === null;

    if (isFinished && gates === "unfinished") {
        return task;
    }

    const readDocument = (file: string): Promise<string | null> => readChangeDocument(changeDir, file, { signal });
    const files = [
        "intent.md",
        "spec.md",
        "plan.md",
        "tasks.md",
        "verification.md",
        "spike.md",
        "review.md",
        "security-review.md",
    ];
    const [intent, spec, plan, tasks, verification, spike, review, securityReview] = await Promise.all(
        files.map(readDocument),
    );
    const problems = gateProblems(task.value, {
        intent: intent ?? null,
        spec: spec ?? null,
        plan: plan ?? null,
        tasks: tasks ?? null,
        verification: verification ?? null,
        spike: spike ?? null,
        review: review ?? null,
        securityReview: securityReview ?? null,
    });

    return problems.length === 0 ? task : { kind: "invalid", errors: problems };
}

async function readChanges(projectDir: string, { signal }: { readonly signal: AbortSignal }): Promise<Change[]> {
    const changesDir = path.join(projectDir, CHANGES_DIR);
    const entries = await readDir(changesDir, { maxEntries: CHANGES_MAX, signal }).catch(whenMissing([]));
    const folders = entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => entry.name)
        .toSorted();

    const readOne = async (name: string): Promise<Change> => {
        const task = await readChange(path.join(changesDir, name), { gates: "unfinished", signal });

        return task.kind === "valid"
            ? { kind: "valid", name, task: task.value }
            : { kind: "invalid", name, errors: task.errors };
    };

    return mapConcurrent(folders, readOne, { concurrency: READS_IN_FLIGHT_MAX, signal });
}

const COMMANDS = ["check", "status", "reminder", "pr-body"] as const;

type Command = (typeof COMMANDS)[number];

const isCommand = (value: string | undefined): value is Command => COMMANDS.some((command) => command === value);

const USAGE =
    "Usage: changes.ts check <task.md> | status [projectDir] | reminder [projectDir] | pr-body <change folder> [--base <branch>] (base defaults to main)";
const BASE_DEFAULT = "main";

type PrBodyArguments =
    | { readonly kind: "valid"; readonly folder: string; readonly base: string }
    | { readonly kind: "invalid"; readonly error: string };

const invalidArguments = (error: string): PrBodyArguments => ({ kind: "invalid", error });

/** The arguments after `pr-body`: the change folder, and optionally `--base <branch>`. */
function parsePrBodyArguments(args: readonly string[]): PrBodyArguments {
    const baseAt = args.indexOf("--base");
    const hasBase = baseAt !== -1;
    const baseValue = hasBase ? args[baseAt + 1] : BASE_DEFAULT;
    const isBaseUsable = baseValue !== undefined && baseValue.trim() !== "" && !baseValue.startsWith("-");
    const others = hasBase ? args.filter((_, index) => index !== baseAt && index !== baseAt + 1) : args;
    const unknownOption = others.find((arg) => arg.startsWith("-"));
    const [folder, extra] = others;

    if (!isBaseUsable) {
        return invalidArguments("--base needs a branch name that isn't blank or starting with -");
    }
    if (unknownOption !== undefined) {
        return invalidArguments(
            unknownOption === "--base" ? "--base is given more than once" : `unknown option ${unknownOption}`,
        );
    }
    if (folder === undefined) {
        return invalidArguments("pr-body needs the change folder");
    }
    if (extra !== undefined) {
        return invalidArguments(`unexpected argument ${extra}`);
    }

    return { kind: "valid", folder, base: baseValue };
}

/** The description of a change, or why it can't be rendered yet: every reason is a line for stderr. */
type PrBodyOutcome =
    | { readonly kind: "rendered"; readonly body: string }
    | { readonly kind: "refused"; readonly problems: readonly string[] };

const refused = (...problems: readonly string[]): PrBodyOutcome => ({ kind: "refused", problems });

/**
 * The project a change folder belongs to: the folder three levels up from `<project>/docs/changes/<name>`, so the
 * decision records listed are those of the change's own repository, not of wherever the command runs. `null` when the
 * folder isn't in that shape.
 */
function projectDirOfChange(changeDir: string): string | null {
    const changesDir = path.dirname(changeDir);
    const docsDir = path.dirname(changesDir);
    const isChangeFolder = path.basename(changesDir) === "changes" && path.basename(docsDir) === "docs";

    return isChangeFolder ? path.dirname(docsDir) : null;
}

async function buildPrBody(
    args: readonly string[],
    { signal }: { readonly signal: AbortSignal },
): Promise<PrBodyOutcome> {
    const parsedArguments = parsePrBodyArguments(args);

    if (parsedArguments.kind === "invalid") {
        return refused(parsedArguments.error, USAGE);
    }

    const { folder, base } = parsedArguments;
    const changeDir = path.resolve(folder);
    const projectDir = projectDirOfChange(changeDir);

    if (projectDir === null) {
        return refused(`✗ ${changeDir} is not a change folder: expected <project>/${CHANGES_DIR}/<name>`);
    }

    const change = await readChange(changeDir, { gates: "always", signal });

    if (change.kind === "invalid") {
        return refused(...change.errors.map((error) => `✗ ${error}`));
    }

    const unfinished = change.value.stages.filter((stage) => stage.name !== "finish" && isUnfinished(stage));

    if (unfinished.length > 0) {
        const named = unfinished.map((stage) => `${stage.name} (${stage.status})`).join(", ");

        return refused(`✗ not ready for a pull request: ${named} before finish`);
    }

    const readDocument = (file: string): Promise<string | null> => readChangeDocument(changeDir, file, { signal });
    const documents = await Promise.all(
        ["spec.md", "verification.md", "review.md", "security-review.md"].map(readDocument),
    ).catch((error: unknown) => (error instanceof LinkedDocumentError ? error : Promise.reject(error)));

    if (documents instanceof LinkedDocumentError) {
        return refused(`✗ ${documents.message}`);
    }

    const [spec, verification, review, securityReview] = documents;
    const added = await addedDecisionRecords(projectDir, { base, signal });

    if (added.kind === "unknown-base") {
        return refused(`✗ the base branch "${added.base}" doesn't exist; pass the branch to merge into with --base`);
    }

    const rendered = renderPrBody({
        task: change.value,
        spec: spec ?? null,
        verification: verification ?? null,
        review: review ?? null,
        securityReview: securityReview ?? null,
        decisionRecords: added.records,
    });

    if (rendered.kind === "too-long") {
        return refused(
            `✗ the description is ${rendered.length} characters, over GitHub's limit of ${rendered.max}: shorten the spec, the evidence or the findings`,
        );
    }

    return rendered;
}

const isUnfinished = (stage: StageEntry): boolean => stage.status === "pending" || stage.status === "in-progress";

async function main(): Promise<void> {
    const [command, argument] = Bun.argv.slice(2);
    const signal = interruptSignal();

    if (!isCommand(command)) {
        console.error(USAGE);
        process.exitCode = 1;
        return;
    }

    if (command === "pr-body") {
        const outcome = await buildPrBody(Bun.argv.slice(3), { signal });

        if (outcome.kind === "refused") {
            console.error(outcome.problems.join("\n"));
            process.exitCode = 1;
            return;
        }

        process.stdout.write(outcome.body);
        return;
    }

    if (command === "check") {
        const task = await readChange(path.dirname(path.resolve(argument ?? "task.md")), { gates: "always", signal });

        if (task.kind === "invalid") {
            console.error(task.errors.map((error) => `✗ ${error}`).join("\n"));
            process.exitCode = 1;
            return;
        }

        console.log(`✓ valid route: ${task.value.stages.map((stage) => stage.name).join(" → ")}`);
        return;
    }

    const projectDir = resolveProjectDir({
        argument,
        envProjectDir: process.env["CLAUDE_PROJECT_DIR"],
        cwd: process.cwd(),
    });
    const changes = await readChanges(projectDir, { signal });

    if (command === "status") {
        console.log(changesStatus(changes));
        return;
    }

    const output = changesReminder(changes);

    if (output !== null) {
        console.log(JSON.stringify(output));
    }
}

if (import.meta.main) {
    await main();
}

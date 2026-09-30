// Stage gates (ADR 0052): what a stage's document must contain before the stage may be marked done.

import { isNotNil } from "../../../lib/predicates.ts";

/** The sections `intent.md` must have, each with content. */
export const INTENT_SECTIONS = ["Problem", "Outcome", "Affected", "Constraints", "Open questions"] as const;

/** The sections `spec.md` must have, each with content. `Problem` is added when the route has no intent stage. */
export const SPEC_SECTIONS = [
    "Current behaviour",
    "Acceptance criteria",
    "Edge cases",
    "Limits",
    "Out of scope",
] as const;

/** Marks a point the spec couldn't decide; a stage with one left open can't be done. */
export const CLARIFICATION_MARKER = "[NEEDS CLARIFICATION";

const CRITERIA_MAX = 200; // acceptance criteria in one spec; more means the change should be split
const HEADING = /^## (.+?)\s*$/;
const LIST_ITEM = /^\s*[-*] /;
const CRITERION = /^\s*[-*] \*\*(AC-\d+)\*\*:? (.+)$/;
// EARS: ubiquitous (THE … SHALL), event (WHEN), state (WHILE), unwanted behaviour (IF … THEN), optional (WHERE).
const EARS_START = /^(WHEN|WHILE|IF|WHERE|THE)\b/;
const EARS_SHALL = /\bSHALL\b/;

/** A markdown document's `## ` sections, by heading, with their text. */
function sections(markdown: string): ReadonlyMap<string, string> {
    const result = new Map<string, string[]>();
    let current: string[] | null = null;

    // Stateful on purpose: each line belongs to the section of the heading above it.
    for (const line of markdown.split("\n")) {
        const heading = HEADING.exec(line);

        if (heading !== null) {
            current = [];
            result.set(heading[1] ?? "", current);
            continue;
        }

        current?.push(line);
    }

    return new Map([...result].map(([heading, lines]) => [heading, lines.join("\n")]));
}

function sectionProblems(markdown: string, required: readonly string[], { file }: { readonly file: string }): string[] {
    const found = sections(markdown);

    return required.flatMap((heading) => {
        const text = found.get(heading);

        if (text === undefined) {
            return [`${file} has no "## ${heading}" section`];
        }

        return text.trim().length === 0 ? [`${file}'s "${heading}" section is empty`] : [];
    });
}

function clarificationProblems(markdown: string, { file }: { readonly file: string }): string[] {
    return markdown.includes(CLARIFICATION_MARKER) ? [`${file} still has an open ${CLARIFICATION_MARKER}]`] : [];
}

/**
 * Checks `intent.md` before the intent stage may be done: every required section has content, and nothing is left
 * marked `[NEEDS CLARIFICATION]`.
 *
 * @param markdown - The contents of `intent.md`.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const intent = ["Problem", "Outcome", "Affected", "Constraints", "Open questions"]
 *     .map((heading) => `## ${heading}\n\nSomething.\n`)
 *     .join("\n");
 *
 * expect(intentProblems(intent)).toEqual([]);
 * expect(intentProblems("## Problem\n\nSlow exports.\n")).toContain('intent.md has no "## Outcome" section');
 * ```
 */
export function intentProblems(markdown: string): string[] {
    return [
        ...sectionProblems(markdown, INTENT_SECTIONS, { file: "intent.md" }),
        ...clarificationProblems(markdown, { file: "intent.md" }),
    ];
}

/**
 * Checks `spec.md` before the spec stage may be done: every required section has content, every item under
 * "Acceptance criteria" is a numbered criterion in EARS form (`- **AC-1**: WHEN … THE SYSTEM SHALL …`) with a unique
 * id, and nothing is left marked `[NEEDS CLARIFICATION]`.
 *
 * @param markdown - The contents of `spec.md`.
 * @param options.needsProblem - `true` when the route has no intent stage, so the spec states the problem itself.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const spec = [
 *     "## Current behaviour\n\nJobs can only be viewed.",
 *     "## Acceptance criteria\n\n- **AC-1**: WHEN the owner exports jobs, THE SYSTEM SHALL download them as CSV.",
 *     "## Edge cases\n\nNo jobs: an empty file with headers.",
 *     "## Limits\n\nAt most 10,000 jobs per export.",
 *     "## Out of scope\n\nOther formats.",
 * ].join("\n\n");
 *
 * expect(specProblems(spec, { needsProblem: false })).toEqual([]);
 * expect(specProblems(spec.replace("WHEN the owner", "The owner can"), { needsProblem: false })).toEqual([
 *     "AC-1 is not in EARS form: start with WHEN, WHILE, IF, WHERE or THE, and say what the system SHALL do",
 * ]);
 * ```
 */
export function specProblems(markdown: string, { needsProblem }: { readonly needsProblem: boolean }): string[] {
    const required = needsProblem ? ["Problem", ...SPEC_SECTIONS] : SPEC_SECTIONS;

    return [
        ...sectionProblems(markdown, required, { file: "spec.md" }),
        ...criteriaProblems(sections(markdown).get("Acceptance criteria") ?? ""),
        ...clarificationProblems(markdown, { file: "spec.md" }),
    ];
}

function criteriaProblems(text: string): string[] {
    const items = text.split("\n").filter((line) => LIST_ITEM.test(line));
    const criteria = items.map((line) => CRITERION.exec(line));
    const ids = criteria.flatMap((match) => (match === null ? [] : [match[1] ?? ""]));
    const duplicates = new Set(ids.filter((id, index) => ids.indexOf(id) !== index));
    const unnumbered = criteria.filter((match) => match === null).length;
    const notEars = criteria
        .filter(isNotNil)
        .filter((match) => !isEars(match[2] ?? ""))
        .map((match) => match[1] ?? "");
    const hasNoCriteria = ids.length === 0;
    const hasTooMany = ids.length > CRITERIA_MAX;

    return [
        hasNoCriteria ? "spec.md has no acceptance criteria" : null,
        hasTooMany ? `spec.md has more than ${CRITERIA_MAX} acceptance criteria: split the change` : null,
        unnumbered > 0 ? `${unnumbered} item(s) under "Acceptance criteria" aren't numbered as - **AC-<n>**: …` : null,
        ...[...duplicates].map((id) => `${id} is used more than once`),
        ...notEars.map(
            (id) =>
                `${id} is not in EARS form: start with WHEN, WHILE, IF, WHERE or THE, and say what the system SHALL do`,
        ),
    ].filter((problem) => problem !== null);
}

const isEars = (text: string): boolean => EARS_START.test(text) && EARS_SHALL.test(text);

/** The sections `plan.md` must have, each with content. `Tasks` is added when the route has no tasks stage. */
export const PLAN_SECTIONS = [
    "Approach",
    "Files and data",
    "Trade-offs",
    "Costs",
    "Conventions and decisions",
] as const;

const TASKS_MAX = 100; // tasks of a few minutes each; more means the change should be split
const TASK_HEADING = /^### (T-\d+):\s*(.*)$/;
const TASK_FIELD = /^\s*[-*] (Files|Covers|Verify|Depends on|Parallel|Status):\s*(.*)$/;
const TASK_STATUSES = ["pending", "in-progress", "done"];
const REQUIRED_TASK_FIELDS = ["Files", "Covers", "Verify", "Status"] as const;
const CRITERION_ID = /\bAC-\d+\b/g;
const TASK_ID = /\bT-\d+\b/g;
const NO_CRITERIA = /^none\b.{3,}/i;

/** One task from a task list, with its fields as written. */
type TaskBlock = { readonly id: string; readonly fields: ReadonlyMap<string, string> };

/**
 * The text of one `## ` section of a markdown document.
 *
 * @param markdown - The document.
 * @param heading - The section's heading, without `## `.
 * @returns The section's text up to the next `## ` heading, or `null` when there is no such section.
 *
 * @example
 * ```ts
 * expect(sectionText("## Tasks\n\n### T-1: Parse\n\n## Notes\n", "Tasks")?.trim()).toBe("### T-1: Parse");
 * expect(sectionText("## Notes\n", "Tasks")).toBeNull();
 * ```
 */
export function sectionText(markdown: string, heading: string): string | null {
    return sections(markdown).get(heading) ?? null;
}

/**
 * The acceptance criteria ids in a spec, split into active and dropped ones (marked "(dropped)", ADR 0052).
 *
 * @param spec - The contents of `spec.md`.
 * @returns The ids, in order.
 *
 * @example
 * ```ts
 * const spec = "## Acceptance criteria\n\n- **AC-1**: THE SYSTEM SHALL export.\n- **AC-2** (dropped): THE SYSTEM SHALL print.";
 *
 * expect(criteriaIds(spec)).toEqual({ active: ["AC-1"], dropped: ["AC-2"] });
 * ```
 */
export function criteriaIds(spec: string): { readonly active: readonly string[]; readonly dropped: readonly string[] } {
    const lines = (sections(spec).get("Acceptance criteria") ?? "").split("\n");
    const numbered = lines.flatMap((line) => {
        const id = /^\s*[-*] \*\*(AC-\d+)\*\*/.exec(line)?.[1];

        return id === undefined ? [] : [{ id, isDropped: line.includes("(dropped)") }];
    });

    return {
        active: numbered.filter((criterion) => !criterion.isDropped).map((criterion) => criterion.id),
        dropped: numbered.filter((criterion) => criterion.isDropped).map((criterion) => criterion.id),
    };
}

function taskBlocks(markdown: string): TaskBlock[] {
    const blocks: { id: string; fields: Map<string, string> }[] = [];

    // Stateful on purpose: each field line belongs to the task heading above it.
    for (const line of markdown.split("\n")) {
        const heading = TASK_HEADING.exec(line);

        if (heading !== null) {
            blocks.push({ id: heading[1] ?? "", fields: new Map() });
            continue;
        }

        const field = TASK_FIELD.exec(line);

        if (field !== null) {
            blocks.at(-1)?.fields.set(field[1] ?? "", (field[2] ?? "").trim());
        }
    }

    return blocks;
}

/**
 * Checks `plan.md` before the plan stage may be done: every required section has content (including "Conventions and
 * decisions", the convention gate), and nothing is left marked `[NEEDS CLARIFICATION]`.
 *
 * @param markdown - The contents of `plan.md`.
 * @param options.hasTasksSection - `true` when the route has no tasks stage, so the plan holds the task list itself.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const plan = ["Approach", "Files and data", "Trade-offs", "Costs", "Conventions and decisions"]
 *     .map((heading) => `## ${heading}\n\nSomething.\n`)
 *     .join("\n");
 *
 * expect(planProblems(plan, { hasTasksSection: false })).toEqual([]);
 * expect(planProblems(plan, { hasTasksSection: true })).toEqual(['plan.md has no "## Tasks" section']);
 * ```
 */
export function planProblems(markdown: string, { hasTasksSection }: { readonly hasTasksSection: boolean }): string[] {
    const required = hasTasksSection ? [...PLAN_SECTIONS, "Tasks"] : PLAN_SECTIONS;

    return [
        ...sectionProblems(markdown, required, { file: "plan.md" }),
        ...clarificationProblems(markdown, { file: "plan.md" }),
    ];
}

/**
 * Checks a task list (`tasks.md`, or the "Tasks" section of `plan.md`): every task has an id `T-<n>`, its files, the
 * criteria it covers, how to verify it and a status; dependencies only point to earlier tasks; and every active
 * acceptance criterion of the spec is covered by a task, while no task covers one that doesn't exist.
 *
 * @param markdown - The task list.
 * @param options.file - How the list is named in messages.
 * @param options.criteria - The spec's active and dropped criteria ids; `null` when the route has no spec.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const tasks = "### T-1: Export\n\n- Files: `src/export.ts`\n- Covers: AC-1\n- Verify: `bun test`\n- Status: pending";
 *
 * expect(taskListProblems(tasks, { file: "tasks.md", criteria: { active: ["AC-1"], dropped: [] } })).toEqual([]);
 * expect(taskListProblems(tasks, { file: "tasks.md", criteria: { active: ["AC-1", "AC-2"], dropped: [] } })).toEqual([
 *     "AC-2 isn't covered by any task in tasks.md",
 * ]);
 * ```
 */
export function taskListProblems(
    markdown: string,
    {
        file,
        criteria,
    }: {
        readonly file: string;
        readonly criteria: { readonly active: readonly string[]; readonly dropped: readonly string[] } | null;
    },
): string[] {
    const blocks = taskBlocks(markdown);
    const ids = blocks.map((block) => block.id);
    const duplicates = new Set(ids.filter((id, index) => ids.indexOf(id) !== index));
    const covered = new Set(
        blocks.flatMap((block) =>
            [...(block.fields.get("Covers") ?? "").matchAll(CRITERION_ID)].map((match) => match[0]),
        ),
    );
    const known = new Set([...(criteria?.active ?? []), ...(criteria?.dropped ?? [])]);
    const uncovered = (criteria?.active ?? []).filter((id) => !covered.has(id));
    const unknown = criteria === null ? [] : [...covered].filter((id) => !known.has(id));
    const coversDropped = [...covered].filter((id) => criteria?.dropped.includes(id) === true);

    return [
        blocks.length === 0 ? `${file} has no tasks (### T-<n>: <title>)` : null,
        blocks.length > TASKS_MAX ? `${file} has more than ${TASKS_MAX} tasks: split the change` : null,
        ...[...duplicates].map((id) => `${id} is used more than once in ${file}`),
        ...blocks.flatMap((block, index) => taskProblems(block, { earlierIds: ids.slice(0, index) })),
        ...uncovered.map((id) => `${id} isn't covered by any task in ${file}`),
        ...unknown.map((id) => `${file} covers ${id}, which the spec doesn't have`),
        ...coversDropped.map((id) => `${file} covers ${id}, which the spec has dropped`),
    ].filter((problem) => problem !== null);
}

function taskProblems(block: TaskBlock, { earlierIds }: { readonly earlierIds: readonly string[] }): string[] {
    const missing = REQUIRED_TASK_FIELDS.filter((field) => (block.fields.get(field) ?? "").length === 0);
    const covers = block.fields.get("Covers") ?? "";
    const hasCriteria = [...covers.matchAll(CRITERION_ID)].length > 0;
    const coversNothingWithoutReason = covers.length > 0 && !hasCriteria && !NO_CRITERIA.test(covers);
    const status = block.fields.get("Status") ?? "";
    const hasUnknownStatus = status.length > 0 && !TASK_STATUSES.includes(status);
    const dependencies = [...(block.fields.get("Depends on") ?? "").matchAll(TASK_ID)].map((match) => match[0]);
    const notEarlier = dependencies.filter((id) => !earlierIds.includes(id));

    return [
        ...missing.map((field) => `${block.id} has no "${field}"`),
        coversNothingWithoutReason
            ? `${block.id} covers no criterion: name them (AC-<n>), or write "none" with the reason`
            : null,
        hasUnknownStatus ? `${block.id} has status "${status}"; use ${TASK_STATUSES.join(", ")}` : null,
        ...notEarlier.map((id) => `${block.id} depends on ${id}, which isn't an earlier task`),
    ].filter((problem) => problem !== null);
}

/**
 * Checks that every task in a task list is done, before the build stage may be done.
 *
 * @param markdown - The task list.
 * @param options.file - How the list is named in messages.
 * @returns A problem per task that isn't done; empty when all are.
 *
 * @example
 * ```ts
 * expect(unfinishedTaskProblems("### T-1: Export\n- Status: done", { file: "tasks.md" })).toEqual([]);
 * expect(unfinishedTaskProblems("### T-1: Export\n- Status: pending", { file: "tasks.md" })).toEqual([
 *     "the build is done, but T-1 in tasks.md is pending",
 * ]);
 * ```
 */
export function unfinishedTaskProblems(markdown: string, { file }: { readonly file: string }): string[] {
    return taskBlocks(markdown)
        .filter((block) => block.fields.get("Status") !== "done")
        .map(
            (block) =>
                `the build is done, but ${block.id} in ${file} is ${block.fields.get("Status") || "without a status"}`,
        );
}

/** The sections `verification.md` must have: the checks that ran, and the evidence per acceptance criterion. */
export const VERIFICATION_SECTIONS = ["Checks", "Evidence"] as const;

/** The sections `spike.md` must have. */
export const SPIKE_SECTIONS = ["Question", "Findings", "Recommendation"] as const;

const EVIDENCE = /^\s*[-*] (AC-\d+):\s*(.*)$/;

/**
 * Checks `verification.md` before the build or verify stage may be done: the checks that ran are listed, and every
 * active acceptance criterion has evidence (the test or check that shows it works) (ADR 0054).
 *
 * @param markdown - The contents of `verification.md`.
 * @param options.criteria - The spec's active and dropped criteria ids; `null` when the route has no spec.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const verification = "## Checks\n\n`bun run check`: passed\n\n## Evidence\n\n- AC-1: `export.test.ts` › exports as CSV";
 * const criteria = { active: ["AC-1", "AC-2"], dropped: [] };
 *
 * expect(verificationProblems(verification, { criteria })).toEqual(["verification.md has no evidence for AC-2"]);
 * ```
 */
export function verificationProblems(
    markdown: string,
    {
        criteria,
    }: { readonly criteria: { readonly active: readonly string[]; readonly dropped: readonly string[] } | null },
): string[] {
    const lines = (sections(markdown).get("Evidence") ?? "").split("\n");
    const evidence = lines.map((line) => EVIDENCE.exec(line)).filter(isNotNil);
    const withEvidence = new Set(
        evidence.filter((match) => (match[2] ?? "").trim().length > 0).map((match) => match[1] ?? ""),
    );
    const missing = (criteria?.active ?? []).filter((id) => !withEvidence.has(id));

    return [
        ...sectionProblems(markdown, VERIFICATION_SECTIONS, { file: "verification.md" }),
        ...missing.map((id) => `verification.md has no evidence for ${id}`),
    ];
}

/**
 * Checks `spike.md` before the spike stage may be done: the question, what was found, and what to do with it.
 *
 * @param markdown - The contents of `spike.md`.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const spike = "## Question\n\nCan Bun stream CSV?\n\n## Findings\n\nYes.\n\n## Recommendation\n\nUse streams.";
 *
 * expect(spikeProblems(spike)).toEqual([]);
 * expect(spikeProblems("## Question\n\nCan Bun stream CSV?")).toContain('spike.md has no "## Findings" section');
 * ```
 */
export function spikeProblems(markdown: string): string[] {
    return sectionProblems(markdown, SPIKE_SECTIONS, { file: "spike.md" });
}

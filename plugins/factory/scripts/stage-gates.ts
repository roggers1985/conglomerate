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
    "Security",
    "Out of scope",
] as const;

/**
 * The questions the spec's Security section answers, each on its own line as `- <question>: <answer>` (ADR 0057).
 * "Public, because …" is an answer; leaving one out is not.
 */
export const SECURITY_QUESTIONS = ["Authentication", "Authorisation", "Untrusted input", "Sensitive data"] as const;

/** Marks a point the spec couldn't decide; a stage with one left open can't be done. */
export const CLARIFICATION_MARKER = "[NEEDS CLARIFICATION";

const SECURITY_ANSWER = /^\s*[-*] (Authentication|Authori[sz]ation|Untrusted input|Sensitive data):(.*)$/s;
const PLACEHOLDER = /^(tbd|todo|\?+|n\/?a|-+|\.\.\.|…)\.?$/i;
const CRITERIA_MAX = 200; // acceptance criteria in one spec; more means the change should be split
// Matched on the trimmed line: a lazy `.+?` before `\s*$` is quadratic on a long run of spaces.
const HEADING = /^## (.+)$/;
const LIST_ITEM = /^\s*[-*] /;
const CRITERION = /^\s*[-*] \*\*(AC-\d+)\*\*:? (.+)$/;
const DROPPED_MARKER = "(dropped)";
// EARS: ubiquitous (THE … SHALL), event (WHEN), state (WHILE), unwanted behaviour (IF … THEN), optional (WHERE).
const EARS_START = /^(WHEN|WHILE|IF|WHERE|THE)\b/;
const EARS_SHALL = /\bSHALL\b/;

/** A markdown document's `## ` sections, by heading, with their text. */
function sections(markdown: string): ReadonlyMap<string, string> {
    const result = new Map<string, string[]>();
    let current: string[] | null = null;

    // Stateful on purpose: each line belongs to the section of the heading above it.
    for (const line of markdown.split("\n")) {
        const heading = HEADING.exec(line.trimEnd());

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
 * Checks `spec.md` before the spec stage may be done: every required section has content, the Security section
 * answers its four questions (ADR 0057), every item under
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
 *     "## Security\n\n- Authentication: logged in\n- Authorisation: own jobs\n- Untrusted input: none\n- Sensitive data: none",
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
        ...securityProblems(sections(markdown).get("Security") ?? null),
        ...clarificationProblems(markdown, { file: "spec.md" }),
    ];
}

/** Every security question answered in the Security section; nothing when the section itself is missing. */
function securityProblems(text: string | null): string[] {
    if (text === null) {
        return [];
    }

    const answers = new Map(
        text
            .split("\n")
            .map((line) => SECURITY_ANSWER.exec(line))
            .filter(isNotNil)
            .map(
                (match) =>
                    [(match[1] ?? "").replace("Authorization", "Authorisation"), (match[2] ?? "").trim()] as const,
            ),
    );
    const unanswered = SECURITY_QUESTIONS.filter((question) => (answers.get(question) ?? "").length === 0);
    const placeholders = SECURITY_QUESTIONS.filter((question) => PLACEHOLDER.test(answers.get(question) ?? ""));

    return [
        ...unanswered.map(
            (question) => `spec.md's Security section doesn't answer "${question}": who, what, or "Public, because …"`,
        ),
        ...placeholders.map(
            (question) =>
                `spec.md's answer to "${question}" is a placeholder: answer it, or mark it [NEEDS CLARIFICATION: …]`,
        ),
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
const TASK_HEADING = /^### (T-\d+):(.*)$/s;
const TASK_FIELD = /^\s*[-*] (Files|Covers|Verify|Depends on|Parallel|Status):(.*)$/s;
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
    const numbered = criteria(spec);

    return {
        active: numbered.filter((criterion) => !criterion.isDropped).map((criterion) => criterion.id),
        dropped: numbered.filter((criterion) => criterion.isDropped).map((criterion) => criterion.id),
    };
}

/**
 * Every numbered criterion under "Acceptance criteria" in a spec, with its text (ADR 0052). A criterion marked
 * "(dropped)" is flagged, and the marker is left out of its text.
 *
 * @param spec - The contents of `spec.md`.
 * @returns The criteria, in order; empty when there is no section or no criterion.
 *
 * @example
 * ```ts
 * const spec = "## Acceptance criteria\n\n- **AC-1**: WHEN asked, THE SYSTEM SHALL export.\n- **AC-2** (dropped): THE SYSTEM SHALL print.";
 *
 * expect(criteria(spec)).toEqual([
 *     { id: "AC-1", text: "WHEN asked, THE SYSTEM SHALL export.", isDropped: false },
 *     { id: "AC-2", text: "THE SYSTEM SHALL print.", isDropped: true },
 * ]);
 * ```
 */
export function criteria(
    spec: string,
): readonly { readonly id: string; readonly text: string; readonly isDropped: boolean }[] {
    return (sections(spec).get("Acceptance criteria") ?? "")
        .split("\n")
        .map((line) => CRITERION.exec(line))
        .filter(isNotNil)
        .map((match) => {
            const text = match[2] ?? "";

            return {
                id: match[1] ?? "",
                text: text.replace(DROPPED_MARKER, "").replace(/^:/, "").trim(),
                isDropped: text.includes(DROPPED_MARKER),
            };
        });
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
        blocks.length === 0 ? `${file} has no tasks (### T-<n>: <title>)${headingHint(markdown)}` : null,
        blocks.length > TASKS_MAX ? `${file} has more than ${TASKS_MAX} tasks: split the change` : null,
        ...[...duplicates].map((id) => `${id} is used more than once in ${file}`),
        ...blocks.flatMap((block, index) => taskProblems(block, { earlierIds: ids.slice(0, index) })),
        ...uncovered.map((id) => `${id} isn't covered by any task in ${file}`),
        ...unknown.map((id) => `${file} covers ${id}, which the spec doesn't have`),
        ...coversDropped.map((id) => `${file} covers ${id}, which the spec has dropped`),
    ].filter((problem) => problem !== null);
}

/** A hint for task headings written with the wrong number of `#`, the most likely reason no task was found. */
function headingHint(markdown: string): string {
    const misspelled = /^(#{1,2}|#{4,}) (T-\d+)/m.exec(markdown);

    return misspelled === null ? "" : `; found "${misspelled[1]} ${misspelled[2]}": tasks use three #`;
}

function taskProblems(block: TaskBlock, { earlierIds }: { readonly earlierIds: readonly string[] }): string[] {
    const missing = REQUIRED_TASK_FIELDS.filter((field) => !block.fields.has(field));
    const empty = REQUIRED_TASK_FIELDS.filter((field) => block.fields.get(field) === "");
    const covers = block.fields.get("Covers") ?? "";
    const hasCriteria = [...covers.matchAll(CRITERION_ID)].length > 0;
    const coversNothingWithoutReason = covers.length > 0 && !hasCriteria && !NO_CRITERIA.test(covers);
    const status = block.fields.get("Status") ?? "";
    const hasUnknownStatus = status.length > 0 && !TASK_STATUSES.includes(status);
    const dependencies = [...(block.fields.get("Depends on") ?? "").matchAll(TASK_ID)].map((match) => match[0]);
    const notEarlier = dependencies.filter((id) => !earlierIds.includes(id));

    return [
        ...missing.map((field) => `${block.id} has no "${field}"`),
        ...empty.map((field) => `${block.id}'s "${field}" is empty: write its value on the same line`),
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

/** The sections `migration-plan.md` must have: steps, coexistence, behaviour test, verification and rollback. */
export const MIGRATION_PLAN_SECTIONS = ["Steps", "Old and new", "Behaviour test", "Verification", "Rollback"] as const;

const EVIDENCE = /^\s*[-*] (AC-\d+):(.*)$/s;

/**
 * The evidence per acceptance criterion in `verification.md`'s "Evidence" section (ADR 0054).
 *
 * @param verification - The contents of `verification.md`.
 * @returns The evidence text by criterion id; criteria with empty evidence are left out.
 *
 * @example
 * ```ts
 * const verification = "## Evidence\n\n- AC-1: `export.test.ts` › exports as CSV\n- AC-2:";
 *
 * expect(evidence(verification)).toEqual(new Map([["AC-1", "`export.test.ts` › exports as CSV"]]));
 * ```
 */
export function evidence(verification: string): ReadonlyMap<string, string> {
    return new Map(
        (sections(verification).get("Evidence") ?? "")
            .split("\n")
            .map((line) => EVIDENCE.exec(line))
            .filter(isNotNil)
            .map((match) => [match[1] ?? "", (match[2] ?? "").trim()] as const)
            .filter(([, text]) => text.length > 0),
    );
}

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
    const named = new Set(evidence.map((match) => match[1] ?? ""));
    const known = new Set([...(criteria?.active ?? []), ...(criteria?.dropped ?? [])]);
    const unknown = criteria === null ? [] : [...named].filter((id) => !known.has(id));
    const dropped = [...named].filter((id) => criteria?.dropped.includes(id) === true);

    return [
        ...sectionProblems(markdown, VERIFICATION_SECTIONS, { file: "verification.md" }),
        ...missing.map((id) => `verification.md has no evidence for ${id}`),
        ...unknown.map((id) => `verification.md has evidence for ${id}, which the spec doesn't have`),
        ...dropped.map((id) => `verification.md has evidence for ${id}, which the spec has dropped`),
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

/**
 * Checks `migration-plan.md` before the migration-plan stage may be done: the steps, how the old and new coexist, the
 * test that shows the behaviour stayed the same, the verification and the rollback. Nothing may be left marked
 * `[NEEDS CLARIFICATION]`: a step that can't be rolled back needs the owner's explicit approval first.
 *
 * @param markdown - The contents of `migration-plan.md`.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const plan = MIGRATION_PLAN_SECTIONS.map((section) => `## ${section}\n\nSomething.`).join("\n\n");
 *
 * expect(migrationPlanProblems(plan)).toEqual([]);
 * expect(migrationPlanProblems("## Steps\n\nMove it.")).toContain('migration-plan.md has no "## Rollback" section');
 * ```
 */
export function migrationPlanProblems(markdown: string): string[] {
    return [
        ...sectionProblems(markdown, MIGRATION_PLAN_SECTIONS, { file: "migration-plan.md" }),
        ...clarificationProblems(markdown, { file: "migration-plan.md" }),
    ];
}

/** The sections a review document (`review.md`, `security-review.md`) must have. */
export const REVIEW_SECTIONS = ["Summary", "Findings"] as const;

const SEVERITIES = ["high", "medium", "low"];
const FINDINGS_MAX = 200; // findings in one review; more means the change should go back to planning
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_SEPARATOR = /^[\s|:-]+$/;
const CELL_SEPARATOR = /(?<!\\)\|/; // an escaped \| belongs to the cell
const NO_FINDINGS = /^none\.?$/i;
const FINDING_STATUS = /^(fixed|accepted by owner: .{3,}|accepted: .{3,})$/i;

/**
 * Checks a review document before the review or security-review stage may be done (ADR 0055): a summary, and a
 * findings table (`| # | Severity | Finding | Where | Status |`, or "None." when there are none) where no finding is
 * left open. A high-severity finding is fixed or accepted by the owner; a medium or low one is fixed, or accepted with
 * a reason.
 *
 * @param markdown - The review document.
 * @param options.file - How the document is named in messages.
 * @returns Every problem found; empty when the gate passes.
 *
 * @example
 * ```ts
 * const header = "| # | Severity | Finding | Where | Status |\n| - | - | - | - | - |";
 * const review = (row: string) => `## Summary\n\nGood.\n\n## Findings\n\n${header}\n${row}`;
 *
 * expect(reviewProblems(review("| 1 | low | A long name | `a.ts:3` | fixed |"), { file: "review.md" })).toEqual([]);
 * expect(reviewProblems(review("| 1 | high | No auth check | `api.ts:9` | open |"), { file: "review.md" })).toEqual([
 *     'review.md: finding 1 (high) is "open"; a high finding is fixed, or "accepted by owner: <reason>"',
 * ]);
 * ```
 */
export function reviewProblems(markdown: string, { file }: { readonly file: string }): string[] {
    const text = sections(markdown).get("Findings") ?? "";
    const findings = findingRows(text);
    const hasTable = text.split("\n").some((line) => TABLE_ROW.test(line));
    const saysNone = NO_FINDINGS.test(text.trim());
    const hasUntabledFindings = text.trim().length > 0 && !hasTable && !saysNone;

    return [
        ...sectionProblems(markdown, REVIEW_SECTIONS, { file }),
        hasUntabledFindings
            ? `${file}: findings must be in the table (| # | Severity | Finding | Where | Status |), or the section must say "None."`
            : null,
        findings.length > FINDINGS_MAX ? `${file} has more than ${FINDINGS_MAX} findings: go back to planning` : null,
        ...findings.flatMap((cells) => findingProblems(cells, { file })),
    ].filter((problem) => problem !== null);
}

/** The cells of each row of a findings table, without the header and the separator. */
function findingRows(findingsText: string): string[][] {
    return findingsText
        .split("\n")
        .map((line) => TABLE_ROW.exec(line)?.[1])
        .filter(isNotNil)
        .filter((row) => !TABLE_SEPARATOR.test(row))
        .map((row) => row.split(CELL_SEPARATOR).map((cell) => cell.trim()))
        .filter((cells) => cells[0] !== "#");
}

/**
 * The rows of a review document's findings table (ADR 0055).
 *
 * @param review - The review document.
 * @returns The findings, in order, as trimmed text; empty for "None." or when there is no table. Rows that don't have
 * five columns are left out (`reviewProblems` reports them).
 *
 * @example
 * ```ts
 * const review = [
 *     "## Findings",
 *     "",
 *     "| # | Severity | Finding | Where | Status |",
 *     "| - | - | - | - | - |",
 *     "| 1 | low | A long name | `a.ts:3` | fixed |",
 * ].join("\n");
 *
 * expect(reviewFindings(review)).toEqual([
 *     { id: "1", severity: "low", finding: "A long name", where: "`a.ts:3`", status: "fixed" },
 * ]);
 * expect(reviewFindings("## Findings\n\nNone.")).toEqual([]);
 * ```
 */
export function reviewFindings(review: string): readonly {
    readonly id: string;
    readonly severity: string;
    readonly finding: string;
    readonly where: string;
    readonly status: string;
}[] {
    return findingRows(sections(review).get("Findings") ?? "").flatMap((cells) => {
        const [id, severity, finding, where, status] = cells;

        return cells.length === 5
            ? [
                  {
                      id: id ?? "",
                      severity: severity ?? "",
                      finding: finding ?? "",
                      where: where ?? "",
                      status: status ?? "",
                  },
              ]
            : [];
    });
}

function findingProblems(cells: readonly string[], { file }: { readonly file: string }): string[] {
    const [id = "?", severity = "", , , status = ""] = cells;
    const hasFiveColumns = cells.length === 5;
    const isKnownSeverity = SEVERITIES.includes(severity.toLowerCase());
    const isClosed = FINDING_STATUS.test(status);
    const isHigh = severity.toLowerCase() === "high";
    const isAcceptedWithoutOwner = isHigh && /^accepted: /i.test(status);

    if (!hasFiveColumns) {
        return [`${file}: finding ${id} needs 5 columns: # | Severity | Finding | Where | Status`];
    }

    return [
        isKnownSeverity ? null : `${file}: finding ${id} has severity "${severity}"; use ${SEVERITIES.join(", ")}`,
        isClosed ? null : `${file}: finding ${id} (${severity}) is "${status}"; ${closeHint(isHigh)}`,
        isAcceptedWithoutOwner ? `${file}: finding ${id} is high, so only the owner can accept it` : null,
    ].filter((problem) => problem !== null);
}

const closeHint = (isHigh: boolean): string =>
    isHigh ? 'a high finding is fixed, or "accepted by owner: <reason>"' : 'use "fixed" or "accepted: <reason>"';

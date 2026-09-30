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

import { describe, expect, it } from "bun:test";
import { INTENT_SECTIONS, intentProblems, SPEC_SECTIONS, specProblems } from "./stage-gates.ts";

const document = (headings: readonly string[], overrides: ReadonlyMap<string, string> = new Map()): string =>
    headings.map((heading) => `## ${heading}\n\n${overrides.get(heading) ?? "Something."}\n`).join("\n");

const criteria = (...lines: readonly string[]): string => lines.join("\n");

const spec = (acceptanceCriteria: string, overrides: ReadonlyMap<string, string> = new Map()): string =>
    document(SPEC_SECTIONS, new Map([["Acceptance criteria", acceptanceCriteria], ...overrides]));

const ac1 = "- **AC-1**: WHEN the owner exports jobs, THE SYSTEM SHALL download them as CSV.";

describe("intentProblems", () => {
    it("passes an intent with every section filled in", () => {
        expect(intentProblems(document(INTENT_SECTIONS))).toEqual([]);
    });

    it("names every missing or empty section", () => {
        expect(intentProblems(document(["Problem", "Outcome"], new Map([["Outcome", "  "]])))).toEqual([
            `intent.md's "Outcome" section is empty`,
            'intent.md has no "## Affected" section',
            'intent.md has no "## Constraints" section',
            'intent.md has no "## Open questions" section',
        ]);
    });

    it("refuses an open [NEEDS CLARIFICATION] marker", () => {
        const intent = document(
            INTENT_SECTIONS,
            new Map([["Outcome", "Faster exports [NEEDS CLARIFICATION: how fast?]"]]),
        );

        expect(intentProblems(intent)).toEqual(["intent.md still has an open [NEEDS CLARIFICATION]"]);
    });
});

describe("specProblems", () => {
    it("passes a spec with every section and a criterion in EARS form", () => {
        expect(specProblems(spec(ac1), { needsProblem: false })).toEqual([]);
    });

    it("accepts each EARS pattern: ubiquitous, event, state, unwanted behaviour and optional feature", () => {
        const all = criteria(
            "- **AC-1**: THE SYSTEM SHALL name the file jobs.csv.",
            ac1.replace("AC-1", "AC-2"),
            "- **AC-3**: WHILE an export runs, THE SYSTEM SHALL disable the export button.",
            "- **AC-4**: IF the export fails, THEN THE SYSTEM SHALL show the reason.",
            "- **AC-5**: WHERE the owner is an admin, THE SYSTEM SHALL include archived jobs.",
        );

        expect(specProblems(spec(all), { needsProblem: false })).toEqual([]);
    });

    it("rejects criteria that aren't in EARS form, including lowercase keywords", () => {
        const loose = criteria(
            "- **AC-1**: The owner can export jobs.",
            "- **AC-2**: when the owner exports jobs, the system shall download them.",
        );
        const notEars =
            "is not in EARS form: start with WHEN, WHILE, IF, WHERE or THE, and say what the system SHALL do";

        expect(specProblems(spec(loose), { needsProblem: false })).toEqual([`AC-1 ${notEars}`, `AC-2 ${notEars}`]);
    });

    it("requires numbered criteria with unique ids", () => {
        const items = criteria(ac1, ac1, "- Exports are fast.");

        expect(specProblems(spec(items), { needsProblem: false })).toEqual([
            '1 item(s) under "Acceptance criteria" aren\'t numbered as - **AC-<n>**: …',
            "AC-1 is used more than once",
        ]);
    });

    it("requires at least one criterion, and accepts up to 200", () => {
        const many = (count: number): string =>
            Array.from({ length: count }, (_, index) => ac1.replace("AC-1", `AC-${index + 1}`)).join("\n");

        expect(specProblems(spec("Some prose, no criteria."), { needsProblem: false })).toEqual([
            "spec.md has no acceptance criteria",
        ]);
        expect(specProblems(spec(many(200)), { needsProblem: false })).toEqual([]);
        expect(specProblems(spec(many(201)), { needsProblem: false })).toEqual([
            "spec.md has more than 200 acceptance criteria: split the change",
        ]);
    });

    it("requires a Problem section only when the route has no intent stage", () => {
        expect(specProblems(spec(ac1), { needsProblem: true })).toEqual(['spec.md has no "## Problem" section']);
        expect(specProblems(`## Problem\n\nSlow.\n\n${spec(ac1)}`, { needsProblem: true })).toEqual([]);
    });

    it("requires the current behaviour, edge cases, limits and what's out of scope", () => {
        const onlyCriteria = `## Acceptance criteria\n\n${ac1}\n`;

        expect(specProblems(onlyCriteria, { needsProblem: false })).toEqual([
            'spec.md has no "## Current behaviour" section',
            'spec.md has no "## Edge cases" section',
            'spec.md has no "## Limits" section',
            'spec.md has no "## Out of scope" section',
        ]);
    });

    it("refuses an open [NEEDS CLARIFICATION] marker", () => {
        const unclear = spec(ac1, new Map([["Limits", "[NEEDS CLARIFICATION: how many jobs at most?]"]]));

        expect(specProblems(unclear, { needsProblem: false })).toEqual([
            "spec.md still has an open [NEEDS CLARIFICATION]",
        ]);
    });
});

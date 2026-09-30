import { describe, expect, it } from "bun:test";
import {
    criteriaIds,
    INTENT_SECTIONS,
    intentProblems,
    PLAN_SECTIONS,
    planProblems,
    SPEC_SECTIONS,
    specProblems,
    taskListProblems,
    unfinishedTaskProblems,
} from "./stage-gates.ts";

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

type Fields = readonly (readonly [string, string])[];

const task = (id: string, fields: Fields): string =>
    [`### ${id}: Something`, "", ...fields.map(([name, value]) => `- ${name}: ${value}`)].join("\n");

const validTask = (id: string, covers = "AC-1", extra: Fields = []): string => {
    const fields = new Map<string, string>([
        ["Files", "`src/export.ts`"],
        ["Covers", covers],
        ["Verify", "`bun test`"],
        ["Status", "pending"],
        ...extra,
    ]);

    return task(id, [...fields]);
};

const onlyAc1 = { active: ["AC-1"], dropped: [] } as const;

describe("criteriaIds", () => {
    it("separates active and dropped criteria", () => {
        const spec = `## Acceptance criteria\n\n${ac1}\n- **AC-2** (dropped): THE SYSTEM SHALL print.\n- **AC-3**: THE SYSTEM SHALL log.`;

        expect(criteriaIds(spec)).toEqual({ active: ["AC-1", "AC-3"], dropped: ["AC-2"] });
    });

    it("finds none in a spec without the section", () => {
        expect(criteriaIds("## Limits\n\nNone.")).toEqual({ active: [], dropped: [] });
    });
});

describe("planProblems", () => {
    it("requires every section, including the convention gate", () => {
        expect(planProblems(document(PLAN_SECTIONS), { hasTasksSection: false })).toEqual([]);
        expect(planProblems(document(["Approach"]), { hasTasksSection: false })).toContain(
            'plan.md has no "## Conventions and decisions" section',
        );
    });

    it("requires a Tasks section only when the route has no tasks stage", () => {
        expect(planProblems(document(PLAN_SECTIONS), { hasTasksSection: true })).toEqual([
            'plan.md has no "## Tasks" section',
        ]);
    });

    it("refuses an open [NEEDS CLARIFICATION] marker", () => {
        const plan = document(PLAN_SECTIONS, new Map([["Costs", "[NEEDS CLARIFICATION: expected load?]"]]));

        expect(planProblems(plan, { hasTasksSection: false })).toEqual([
            "plan.md still has an open [NEEDS CLARIFICATION]",
        ]);
    });
});

describe("taskListProblems", () => {
    const check = (markdown: string, criteria: Parameters<typeof taskListProblems>[1]["criteria"] = onlyAc1) =>
        taskListProblems(markdown, { file: "tasks.md", criteria });

    it("passes tasks that cover every active criterion", () => {
        expect(check([validTask("T-1"), validTask("T-2", "none: sets up the test data")].join("\n\n"))).toEqual([]);
    });

    it("needs at least one task", () => {
        expect(check("Nothing planned yet.")).toContain("tasks.md has no tasks (### T-<n>: <title>)");
    });

    it("accepts up to 100 tasks, and no more", () => {
        const tasks = (count: number): string =>
            Array.from({ length: count }, (_, index) => validTask(`T-${index + 1}`)).join("\n\n");

        expect(check(tasks(100))).toEqual([]);
        expect(check(tasks(101))).toEqual(["tasks.md has more than 100 tasks: split the change"]);
    });

    it("names every missing field, and a reused id", () => {
        expect(check([task("T-1", [["Covers", "AC-1"]]), validTask("T-1")].join("\n\n"))).toEqual([
            "T-1 is used more than once in tasks.md",
            'T-1 has no "Files"',
            'T-1 has no "Verify"',
            'T-1 has no "Status"',
        ]);
    });

    it("requires a reason when a task covers no criterion", () => {
        expect(check([validTask("T-1"), validTask("T-2", "setup")].join("\n\n"))).toEqual([
            'T-2 covers no criterion: name them (AC-<n>), or write "none" with the reason',
        ]);
    });

    it("rejects an unknown status", () => {
        expect(check(validTask("T-1", "AC-1", [["Status", "almost"]]))).toEqual([
            'T-1 has status "almost"; use pending, in-progress, done',
        ]);
    });

    it("only allows dependencies on earlier tasks, so there are no cycles", () => {
        const tasks = [
            validTask("T-1", "AC-1", [["Depends on", "T-2"]]),
            validTask("T-2", "AC-1", [["Depends on", "T-1"]]),
        ];

        expect(check(tasks.join("\n\n"))).toEqual(["T-1 depends on T-2, which isn't an earlier task"]);
    });

    it("finds criteria nobody covers, and covered criteria the spec doesn't have or has dropped", () => {
        const criteria = { active: ["AC-1", "AC-2"], dropped: ["AC-3"] } as const;
        const tasks = [validTask("T-1", "AC-1, AC-3"), validTask("T-2", "AC-9")].join("\n\n");

        expect(check(tasks, criteria)).toEqual([
            "AC-2 isn't covered by any task in tasks.md",
            "tasks.md covers AC-9, which the spec doesn't have",
            "tasks.md covers AC-3, which the spec has dropped",
        ]);
    });

    it("skips the coverage check when the route has no spec", () => {
        expect(check(validTask("T-1", "AC-7"), null)).toEqual([]);
    });
});

describe("unfinishedTaskProblems", () => {
    it("names every task that isn't done", () => {
        const tasks = [validTask("T-1", "AC-1", [["Status", "done"]]), validTask("T-2"), task("T-3", [])].join("\n\n");

        expect(unfinishedTaskProblems(tasks, { file: "tasks.md" })).toEqual([
            "the build is done, but T-2 in tasks.md is pending",
            "the build is done, but T-3 in tasks.md is without a status",
        ]);
    });
});

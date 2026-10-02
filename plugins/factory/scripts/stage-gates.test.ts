import { describe, expect, it } from "bun:test";
import {
    criteriaIds,
    INTENT_SECTIONS,
    intentProblems,
    PLAN_SECTIONS,
    planProblems,
    reviewProblems,
    SPEC_SECTIONS,
    specProblems,
    spikeProblems,
    taskListProblems,
    unfinishedTaskProblems,
    verificationProblems,
} from "./stage-gates.ts";

const document = (headings: readonly string[], overrides: ReadonlyMap<string, string> = new Map()): string =>
    headings.map((heading) => `## ${heading}\n\n${overrides.get(heading) ?? "Something."}\n`).join("\n");

const criteria = (...lines: readonly string[]): string => lines.join("\n");

const securityAnswers = [
    "- Authentication: only logged-in users",
    "- Authorisation: owners of the jobs",
    "- Untrusted input: the export's filters, parsed with a schema",
    "- Sensitive data: none",
].join("\n");

const spec = (acceptanceCriteria: string, overrides: ReadonlyMap<string, string> = new Map()): string =>
    document(
        SPEC_SECTIONS,
        new Map([["Acceptance criteria", acceptanceCriteria], ["Security", securityAnswers], ...overrides]),
    );

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
            'spec.md has no "## Security" section',
            'spec.md has no "## Out of scope" section',
        ]);
    });

    it("requires an answer to every security question, where 'public' is an answer", () => {
        const publicPage = securityAnswers.replace("only logged-in users", "Public, because it's the marketing page");
        const unanswered = "- Authentication: only logged-in users\n- Authorisation:\n- Sensitive data: none";

        expect(specProblems(spec(ac1, new Map([["Security", publicPage]])), { needsProblem: false })).toEqual([]);
        expect(specProblems(spec(ac1, new Map([["Security", unanswered]])), { needsProblem: false })).toEqual([
            'spec.md\'s Security section doesn\'t answer "Authorisation": who, what, or "Public, because …"',
            'spec.md\'s Security section doesn\'t answer "Untrusted input": who, what, or "Public, because …"',
        ]);
    });

    it("accepts the American spelling of Authorisation", () => {
        const american = securityAnswers.replace("- Authorisation:", "- Authorization:");

        expect(specProblems(spec(ac1, new Map([["Security", american]])), { needsProblem: false })).toEqual([]);
    });

    it("refuses placeholder answers, pointing to [NEEDS CLARIFICATION]", () => {
        const placeholders = securityAnswers.replace("owners of the jobs", "TBD").replace("none", "n/a");

        expect(specProblems(spec(ac1, new Map([["Security", placeholders]])), { needsProblem: false })).toEqual([
            'spec.md\'s answer to "Authorisation" is a placeholder: answer it, or mark it [NEEDS CLARIFICATION: …]',
            'spec.md\'s answer to "Sensitive data" is a placeholder: answer it, or mark it [NEEDS CLARIFICATION: …]',
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

    it("explains a field whose value was written on the next lines", () => {
        const tasks =
            "### T-1: Export\n- Files:\n  - `a.ts`\n  - `b.ts`\n- Covers: AC-1\n- Verify: `bun test`\n- Status: pending";

        expect(check(tasks)).toEqual(['T-1\'s "Files" is empty: write its value on the same line']);
    });

    it("hints at the heading when tasks use the wrong number of #", () => {
        expect(check("## T-1: Export\n- Files: `a.ts`", null)).toEqual([
            'tasks.md has no tasks (### T-<n>: <title>); found "## T-1": tasks use three #',
        ]);
        expect(check("#### T-2: Export", null)).toEqual([
            'tasks.md has no tasks (### T-<n>: <title>); found "#### T-2": tasks use three #',
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

describe("verificationProblems", () => {
    const criteria = { active: ["AC-1", "AC-2"], dropped: ["AC-3"] } as const;
    const verification = (evidence: string): string =>
        `## Checks\n\n\`bun run check\`: passed\n\n## Evidence\n\n${evidence}`;

    it("passes when every active criterion has evidence, and ignores dropped ones", () => {
        const evidence = "- AC-1: `export.test.ts` › exports as CSV\n- AC-2: `export.test.ts` › disables the button";

        expect(verificationProblems(verification(evidence), { criteria })).toEqual([]);
    });

    it("names every criterion without evidence, including one listed without any", () => {
        expect(verificationProblems(verification("- AC-1:\n"), { criteria })).toEqual([
            "verification.md has no evidence for AC-1",
            "verification.md has no evidence for AC-2",
        ]);
    });

    it("reports evidence for a criterion the spec doesn't have, or has dropped", () => {
        const evidence = "- AC-1: a test\n- AC-2: a test\n- AC-3: an old test\n- AC-9: a typo";

        expect(verificationProblems(verification(evidence), { criteria })).toEqual([
            "verification.md has evidence for AC-9, which the spec doesn't have",
            "verification.md has evidence for AC-3, which the spec has dropped",
        ]);
    });

    it("requires the checks that ran", () => {
        expect(
            verificationProblems("## Evidence\n\n- AC-1: a test", { criteria: { active: ["AC-1"], dropped: [] } }),
        ).toEqual(['verification.md has no "## Checks" section']);
    });

    it("only asks for the sections when the route has no spec", () => {
        expect(verificationProblems(verification("None: no spec."), { criteria: null })).toEqual([]);
    });
});

describe("spikeProblems", () => {
    it("requires the question, the findings and a recommendation", () => {
        expect(spikeProblems(document(["Question", "Findings", "Recommendation"]))).toEqual([]);
        expect(spikeProblems(document(["Question"]))).toEqual([
            'spike.md has no "## Findings" section',
            'spike.md has no "## Recommendation" section',
        ]);
    });
});

describe("reviewProblems", () => {
    const header = "| # | Severity | Finding | Where | Status |\n| - | -------- | ------- | ----- | ------ |";
    const review = (...rows: readonly string[]): string =>
        `## Summary\n\nFollows the spec.\n\n## Findings\n\n${[header, ...rows].join("\n")}`;
    const check = (markdown: string): string[] => reviewProblems(markdown, { file: "review.md" });

    it("passes a review whose findings are all fixed or accepted with a reason", () => {
        expect(
            check(
                review(
                    "| 1 | high | No auth check | `api.ts:9` | fixed |",
                    "| 2 | high | Slow query | `db.ts:4` | accepted by owner: runs once a day |",
                    "| 3 | medium | Unclear name | `a.ts:3` | accepted: matches the domain term |",
                    "| 4 | low | Typo | `b.ts:1` | fixed |",
                ),
            ),
        ).toEqual([]);
    });

    it("passes a review without findings", () => {
        expect(check("## Summary\n\nClean.\n\n## Findings\n\nNone.")).toEqual([]);
    });

    it("refuses open findings, with a hint that fits the severity", () => {
        expect(
            check(review("| 1 | high | No auth check | `api.ts:9` | open |", "| 2 | low | Typo | `b.ts:1` | todo |")),
        ).toEqual([
            'review.md: finding 1 (high) is "open"; a high finding is fixed, or "accepted by owner: <reason>"',
            'review.md: finding 2 (low) is "todo"; use "fixed" or "accepted: <reason>"',
        ]);
    });

    it("lets only the owner accept a high finding, and requires a reason for any acceptance", () => {
        expect(check(review("| 1 | high | No auth check | `api.ts:9` | accepted: later |"))).toEqual([
            "review.md: finding 1 is high, so only the owner can accept it",
        ]);
        expect(check(review("| 1 | low | Typo | `b.ts:1` | accepted |"))).toEqual([
            'review.md: finding 1 (low) is "accepted"; use "fixed" or "accepted: <reason>"',
        ]);
    });

    it("rejects an unknown severity and a row without five columns", () => {
        expect(check(review("| 1 | critical | Leak | `c.ts:2` | fixed |", "| 2 | low | Typo | fixed |"))).toEqual([
            'review.md: finding 1 has severity "critical"; use high, medium, low',
            "review.md: finding 2 needs 5 columns: # | Severity | Finding | Where | Status",
        ]);
    });

    it("refuses findings written outside the table, so none can slip past the gate", () => {
        expect(check("## Summary\n\nMixed.\n\n## Findings\n\n1. high: no auth check (open)")).toEqual([
            'review.md: findings must be in the table (| # | Severity | Finding | Where | Status |), or the section must say "None."',
        ]);
    });

    it("keeps an escaped pipe inside its cell", () => {
        expect(check(review("| 1 | low | `a \\| b` is unclear | `c.ts:1` | fixed |"))).toEqual([]);
    });

    it("requires a summary and the findings section", () => {
        expect(check("## Findings\n\nNone.")).toEqual(['review.md has no "## Summary" section']);
    });

    it("accepts up to 200 findings, and no more", () => {
        const rows = (count: number) =>
            Array.from({ length: count }, (_, index) => `| ${index + 1} | low | Typo | \`b.ts:1\` | fixed |`);

        expect(check(review(...rows(200)))).toEqual([]);
        expect(check(review(...rows(201)))).toEqual(["review.md has more than 200 findings: go back to planning"]);
    });
});

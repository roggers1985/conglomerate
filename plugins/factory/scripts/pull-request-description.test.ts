import { describe, expect, it } from "bun:test";
import { assert } from "../../../lib/assert.ts";
import type { TaskDocument } from "./changes.ts";
import type { DecisionRecord } from "./decision-records.ts";
import { PULL_REQUEST_DESCRIPTION_LENGTH_MAX, renderPullRequestDescription } from "./pull-request-description.ts";

const TABLE_HEADER = "| # | Severity | Finding | Where | Status |\n| - | - | - | - | - |";

const spec = [
    "## Acceptance criteria",
    "",
    "- **AC-1**: WHEN asked, THE SYSTEM SHALL export.",
    "- **AC-2**: THE SYSTEM SHALL print.",
    "- **AC-3** (dropped): THE SYSTEM SHALL sing.",
].join("\n");

const verification = "## Checks\n\nAll passed.\n\n## Evidence\n\n- AC-1: `export.test.ts` > exports\n- AC-2:\n";

function buildReview({ summary = "Looks good.", rows = [] }: { summary?: string; rows?: readonly string[] } = {}) {
    const findings = rows.length === 0 ? "None." : [TABLE_HEADER, ...rows].join("\n");

    return `## Summary\n\n${summary}\n\n## Findings\n\n${findings}\n`;
}

function buildTask({
    deviations = [],
    stages = [
        { name: "spec", level: "guided", status: "done" },
        { name: "plan", level: "trusted", status: "done" },
        { name: "build", level: "trusted", status: "done" },
        { name: "security-review", level: "trusted", status: "done" },
        { name: "review", level: "trusted", status: "done" },
        { name: "finish", level: "guided", status: "in-progress" },
    ],
}: {
    deviations?: string[];
    stages?: TaskDocument["stages"];
} = {}): TaskDocument {
    return {
        title: "Export jobs",
        created: "2026-10-02",
        track: "standard",
        classification: {
            type: "feature",
            size: "small",
            risk: "low",
            reversible: true,
            uncertainty: "low",
            architectureDebt: [],
        },
        stages,
        deviations,
    };
}

function render(overrides: Partial<Parameters<typeof renderPullRequestDescription>[0]> = {}): string {
    const result = renderPullRequestDescription({
        task: buildTask(),
        spec,
        verification,
        review: buildReview(),
        securityReview: buildReview({ summary: "No security issues." }),
        decisionRecords: [],
        ...overrides,
    });

    assert(result.kind === "rendered", `expected a rendered body, got ${result.kind}`);

    return result.body;
}

describe("renderPullRequestDescription", () => {
    it("AC-2: lists the track, every stage with its status, in order", () => {
        const body = render();

        expect(body).toContain("## Route");
        expect(body).toContain("Track: standard");
        expect(body).toContain(
            "spec (done) → plan (done) → build (done) → security-review (done) → review (done) → finish (in-progress)",
        );
    });

    it("AC-2: lists the deviations with their reasons, or says None.", () => {
        const withDeviations = render({ task: buildTask({ deviations: ["Skipped tasks: one file", "Added spike"] }) });

        expect(withDeviations).toContain("- Skipped tasks: one file\n- Added spike");
        expect(render()).toContain("Deviations:\n\nNone.");
    });

    it("AC-2: shows a skipped stage as skipped", () => {
        const body = render({
            task: buildTask({
                stages: [
                    { name: "spec", level: "guided", status: "done" },
                    { name: "security-review", level: "trusted", status: "skipped" },
                    { name: "finish", level: "guided", status: "pending" },
                ],
            }),
        });

        expect(body).toContain("security-review (skipped)");
    });

    it("AC-3: lists every active criterion with its text and evidence", () => {
        const body = render();

        expect(body).toContain(
            "- **AC-1**: WHEN asked, THE SYSTEM SHALL export.\n  Evidence: `export.test.ts` > exports",
        );
    });

    it("AC-3: says when a criterion has no evidence", () => {
        expect(render()).toContain("- **AC-2**: THE SYSTEM SHALL print.\n  Evidence: no evidence recorded");
        expect(render({ verification: null })).toContain(
            "- **AC-1**: WHEN asked, THE SYSTEM SHALL export.\n  Evidence: no evidence recorded",
        );
    });

    it("AC-3: doesn't list a dropped criterion, but says how many were dropped", () => {
        const body = render();

        expect(body).not.toContain("AC-3");
        expect(body).toContain("1 criterion was dropped.");
        expect(render({ spec: `${spec}\n- **AC-4** (dropped): THE SYSTEM SHALL dance.` })).toContain(
            "2 criteria were dropped.",
        );
    });

    it("AC-3: says nothing about dropped criteria when none were dropped", () => {
        expect(render({ spec: spec.split("\n").slice(0, 4).join("\n") })).not.toContain("dropped");
    });

    it("AC-3: says so when the route has no spec", () => {
        expect(render({ spec: null })).toContain("## Acceptance criteria\n\nNo spec on this route.");
    });

    it("AC-4: includes the review's summary and the security review's summary", () => {
        const body = render();

        expect(body).toContain("## Review\n\nLooks good.");
        expect(body).toContain("### Security review\n\nNo security issues.");
    });

    it("AC-4: says there were no findings when both reviews have none", () => {
        expect(render()).toContain("No findings.");
    });

    it("AC-4: says every finding was fixed when none was accepted", () => {
        const body = render({ review: buildReview({ rows: ["| 1 | low | A long name | `a.ts:3` | fixed |"] }) });

        expect(body).toContain("Every finding was fixed.");
        expect(body).not.toContain("No findings.");
    });

    it("AC-4: lists accepted findings from both reviews with severity, finding, where and reason", () => {
        const body = render({
            review: buildReview({
                rows: [
                    "| 1 | low | A long name | `a.ts:3` | fixed |",
                    "| 2 | medium | Slow loop | `b.ts:9` | accepted: bounded by 10 items |",
                ],
            }),
            securityReview: buildReview({
                rows: ["| 1 | high | Open door | `api.ts:1` | accepted by owner: internal tool only |"],
            }),
        });

        expect(body).toContain("Accepted instead of fixed:");
        expect(body).toContain("- **medium**, review #2: Slow loop (`b.ts:9`). accepted: bounded by 10 items");
        expect(body).toContain(
            "- **high**, security review #1: Open door (`api.ts:1`). accepted by owner: internal tool only",
        );
        expect(body).not.toContain("Every finding was fixed.");
        expect(body).not.toContain("A long name (");
    });

    it("AC-4: leaves out the security review when it isn't on the route and has no document", () => {
        const body = render({
            task: buildTask({
                stages: [
                    { name: "spec", level: "guided", status: "done" },
                    { name: "security-review", level: "trusted", status: "skipped" },
                    { name: "review", level: "trusted", status: "done" },
                ],
            }),
            securityReview: null,
        });

        expect(body).not.toContain("### Security review");
        expect(body).toContain("## Review\n\nLooks good.");
    });

    it("AC-4: leaves out a skipped security review's document, even with an open finding", () => {
        const body = render({
            task: buildTask({
                stages: [
                    { name: "spec", level: "guided", status: "done" },
                    { name: "security-review", level: "trusted", status: "skipped" },
                    { name: "review", level: "trusted", status: "done" },
                ],
            }),
            securityReview: buildReview({
                summary: "Stale.",
                rows: ["| 1 | high | Open door | `api.ts:1` | open |"],
            }),
        });

        expect(body).not.toContain("### Security review");
        expect(body).not.toContain("Stale.");
        expect(body).not.toContain("Open door");
        expect(body).toContain("No findings.");
    });

    it("AC-4: leaves out a skipped review's document", () => {
        const body = render({
            task: buildTask({
                stages: [
                    { name: "spec", level: "guided", status: "done" },
                    { name: "review", level: "trusted", status: "skipped" },
                ],
            }),
            securityReview: null,
        });

        expect(body).not.toContain("## Review");
        expect(body).not.toContain("Looks good.");
    });

    it("AC-4: lists a finding with an unexpected status instead of counting it as fixed", () => {
        const body = render({
            review: buildReview({
                rows: ["| 1 | low | Done thing | `a.ts:3` | fixed |", "| 2 | medium | Odd one | `b.ts:9` | open |"],
            }),
        });

        expect(body).not.toContain("Every finding was fixed.");
        expect(body).toContain("Not fixed or accepted:");
        expect(body).toContain("- **medium**, review #2: Odd one (`b.ts:9`). open");
        expect(body).not.toContain("Done thing");
    });

    it("AC-4: notes a review that is on the route but has no document", () => {
        expect(render({ securityReview: null })).toContain("### Security review\n\nNo security review recorded.");
    });

    it("AC-5: lists the decision records, marking the Proposed ones", () => {
        const decisionRecords: readonly DecisionRecord[] = [
            {
                file: "docs/decisions/0056-pull-request-description.md",
                title: "56. The pull request description",
                isProposed: false,
            },
            { file: "docs/decisions/0057-x.md", title: "57. Something", isProposed: true },
        ];
        const body = render({ decisionRecords });

        expect(body).toContain(
            "## Decisions\n\n- 56. The pull request description (`docs/decisions/0056-pull-request-description.md`)\n",
        );
        expect(body).toContain("- 57. Something (`docs/decisions/0057-x.md`) — Proposed");
    });

    it("AC-5: says so when no decision records were added", () => {
        expect(render()).toContain("## Decisions\n\nNo new decision records.");
    });

    it("neutralises an HTML comment opener in copied text, so it can't hide the rest of the description", () => {
        const body = render({
            task: buildTask({ deviations: ["skipped <!-- the plan"] }),
            review: buildReview({ summary: "Fine <!-- hidden" }),
            decisionRecords: [{ file: "docs/decisions/0001-x.md", title: "1. <!-- X", isProposed: false }],
        });

        expect(body).not.toContain("<!--");
        expect(body).toContain("skipped <!\u200D-- the plan");
        expect(body).toContain("Fine <!\u200D-- hidden");
        expect(body).toContain("1. <!\u200D-- X");
    });

    it("breaks a comment opener inside a code span without showing an entity there", () => {
        const body = render({ review: buildReview({ summary: "The `<!--` marker, and <!-- in prose." }) });

        expect(body).not.toContain("<!--");
        expect(body).not.toContain("&lt;");
        expect(body).toContain("The `<!\u200D--` marker, and <!\u200D-- in prose.");
    });

    it("renders a decision record file name with a newline or a backtick on one line, inside its code span", () => {
        const decisionRecords: readonly DecisionRecord[] = [
            { file: "docs/decisions/a`b\n- injected.md", title: "1. X", isProposed: false },
        ];
        const decisions = render({ decisionRecords }).split("## Decisions\n\n")[1];

        expect(decisions).toBe("- 1. X (`docs/decisions/a?b?- injected.md`)\n");
    });

    it("AC-9: renders the same body twice for the same input", () => {
        const decisionRecords: readonly DecisionRecord[] = [
            { file: "docs/decisions/0001-x.md", title: "1. X", isProposed: true },
        ];

        expect(render({ decisionRecords })).toBe(render({ decisionRecords }));
    });

    it("AC-8: renders a body of exactly the maximum length, and refuses one character more", () => {
        const base = render({ review: buildReview({ summary: "x" }) });
        const padding = PULL_REQUEST_DESCRIPTION_LENGTH_MAX - base.length;
        const exact = renderPullRequestDescription({
            task: buildTask(),
            spec,
            verification,
            review: buildReview({ summary: "x".repeat(1 + padding) }),
            securityReview: buildReview({ summary: "No security issues." }),
            decisionRecords: [],
        });
        const over = renderPullRequestDescription({
            task: buildTask(),
            spec,
            verification,
            review: buildReview({ summary: "x".repeat(2 + padding) }),
            securityReview: buildReview({ summary: "No security issues." }),
            decisionRecords: [],
        });

        expect(exact.kind).toBe("rendered");
        expect(exact.kind === "rendered" ? exact.body.length : 0).toBe(PULL_REQUEST_DESCRIPTION_LENGTH_MAX);
        expect(over).toEqual({
            kind: "too-long",
            length: PULL_REQUEST_DESCRIPTION_LENGTH_MAX + 1,
            max: PULL_REQUEST_DESCRIPTION_LENGTH_MAX,
        });
    });
});

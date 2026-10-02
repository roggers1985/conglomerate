// The pull request description of a change (ADR 0056), rendered from its parsed documents. Pure: no I/O.

import type { TaskDocument } from "./changes.ts";
import type { DecisionRecord } from "./decision-records.ts";
import { criteria, evidence, reviewFindings, sectionText } from "./stage-gates.ts";

/**
 * The longest pull request description GitHub accepts, counted in UTF-16 code units (JavaScript's `string.length`).
 *
 * @remarks
 * GitHub rejects a pull request body over 65,536 characters, so a longer description is refused rather than cut. A
 * character outside the Basic Multilingual Plane (an emoji) is two UTF-16 code units, so the count never falls below
 * GitHub's: a description that passes is accepted, and one just over the limit in code units may be refused although
 * GitHub would count it as fitting.
 */
export const PR_BODY_LENGTH_MAX = 65_536;

/** What {@link renderPrBody} needs: the change's route and the contents of its documents; `null` for a missing one. */
type PrBodyInputs = {
    readonly task: TaskDocument;
    readonly spec: string | null;
    readonly verification: string | null;
    readonly review: string | null;
    readonly securityReview: string | null;
    readonly decisionRecords: readonly DecisionRecord[];
};

/** The outcome of {@link renderPrBody}: the description, or the length that made it too long for GitHub. */
type PrBodyResult =
    | { readonly kind: "rendered"; readonly body: string }
    | { readonly kind: "too-long"; readonly length: number; readonly max: number };

type Finding = ReturnType<typeof reviewFindings>[number];

/** A finding with the review it came from, to name it in the list of accepted findings. */
type SourcedFinding = Finding & { readonly source: string };

const ACCEPTED = /^accepted/i;
const FIXED = /^fixed$/i;
const COMMENT_OPENER = "<!--";
// A zero-width joiner between `<!` and `--` breaks the opener, and shows nothing both in prose and inside a code span,
// where an HTML entity such as `&lt;` would be shown literally.
const COMMENT_OPENER_BROKEN = "<!\u200D--";
const FILE_NAME_BREAKING = /[\r\n`]/g; // would end the code span or the list item the file name sits in

/**
 * Renders a change's pull request description in GitHub Markdown: the route with its deviations, the active
 * acceptance criteria with their evidence, the reviews' summaries with the findings accepted instead of fixed, and the
 * decision records the change added.
 *
 * @remarks
 * Pure and deterministic: the same inputs give the same description (no dates, no randomness). A review part is left
 * out when its stage isn't on the route (missing or skipped), whatever its document says; when the stage is on the
 * route and the document is missing, the part says nothing was recorded. A description over
 * {@link PR_BODY_LENGTH_MAX} UTF-16 code units (`string.length`, never fewer than GitHub's characters) is reported,
 * never truncated.
 *
 * @param inputs - The change's task document, the contents of its documents (`null` when a file doesn't exist) and
 *   the decision records its branch added.
 * @returns `rendered` with the description, or `too-long` with its length and the maximum.
 *
 * @example
 * ```ts
 * const result = renderPrBody({
 *     task: {
 *         title: "Export jobs",
 *         created: "2026-10-02",
 *         track: "standard",
 *         classification: {
 *             type: "feature",
 *             size: "small",
 *             risk: "low",
 *             reversible: true,
 *             uncertainty: "low",
 *             architectureDebt: [],
 *         },
 *         stages: [
 *             { name: "spec", level: "guided", status: "done" },
 *             { name: "review", level: "trusted", status: "done" },
 *             { name: "finish", level: "guided", status: "in-progress" },
 *         ],
 *         deviations: [],
 *     },
 *     spec: "## Acceptance criteria\n\n- **AC-1**: WHEN asked, THE SYSTEM SHALL export.",
 *     verification: "## Evidence\n\n- AC-1: `export.test.ts`",
 *     review: "## Summary\n\nGood.\n\n## Findings\n\nNone.",
 *     securityReview: null,
 *     decisionRecords: [],
 * });
 *
 * expect(result.kind).toBe("rendered");
 * expect(result.kind === "rendered" && result.body).toContain("spec (done) → review (done) → finish (in-progress)");
 * expect(result.kind === "rendered" && result.body).toContain("Evidence: `export.test.ts`");
 * ```
 */
export function renderPrBody(inputs: PrBodyInputs): PrBodyResult {
    const text = `${[
        routeSection(inputs.task),
        criteriaSection(inputs),
        reviewSection(inputs),
        decisionsSection(inputs.decisionRecords),
    ]
        .filter((section) => section !== null)
        .join("\n\n")}\n`;
    // GitHub reads an HTML comment opener as hiding everything after it, so the copied text never carries one.
    const body = text.replaceAll(COMMENT_OPENER, COMMENT_OPENER_BROKEN);

    if (body.length > PR_BODY_LENGTH_MAX) {
        return { kind: "too-long", length: body.length, max: PR_BODY_LENGTH_MAX };
    }

    return { kind: "rendered", body };
}

function routeSection(task: TaskDocument): string {
    const stages = task.stages.map((stage) => `${stage.name} (${stage.status})`).join(" → ");
    const deviations = task.deviations.length === 0 ? "None." : task.deviations.map((item) => `- ${item}`).join("\n");

    return `## Route\n\nTrack: ${task.track}\n\n${stages}\n\nDeviations:\n\n${deviations}`;
}

function criteriaSection({ spec, verification }: PrBodyInputs): string {
    if (spec === null) {
        return "## Acceptance criteria\n\nNo spec on this route.";
    }

    const found = criteria(spec);
    const evidenceById = evidence(verification ?? "");
    const active = found.filter((criterion) => !criterion.isDropped);
    const droppedCount = found.length - active.length;
    const items = active.map(
        (criterion) =>
            `- **${criterion.id}**: ${criterion.text}\n  Evidence: ${evidenceById.get(criterion.id) ?? "no evidence recorded"}`,
    );
    const droppedNote = droppedCount === 0 ? [] : [droppedNoteText(droppedCount)];

    return ["## Acceptance criteria", items.join("\n"), ...droppedNote].filter((part) => part !== "").join("\n\n");
}

const droppedNoteText = (count: number): string =>
    count === 1 ? "1 criterion was dropped." : `${count} criteria were dropped.`;

/** The review part, or `null` when neither review is on the route (a stage that is missing or skipped). */
function reviewSection({ task, review, securityReview }: PrBodyInputs): string | null {
    const isOnRoute = (name: string): boolean =>
        task.stages.some((stage) => stage.name === name && stage.status !== "skipped");
    const hasReview = isOnRoute("review");
    const hasSecurityReview = isOnRoute("security-review");

    if (!hasReview && !hasSecurityReview) {
        return null;
    }

    const findings: readonly SourcedFinding[] = [
        ...(hasReview ? sourced(review, "review") : []),
        ...(hasSecurityReview ? sourced(securityReview, "security review") : []),
    ];
    const parts = [
        "## Review",
        ...(hasReview ? [summaryText(review, "No review recorded.")] : []),
        ...(hasSecurityReview
            ? ["### Security review", summaryText(securityReview, "No security review recorded.")]
            : []),
        findingsText(findings),
    ];

    return parts.join("\n\n");
}

function summaryText(document: string | null, whenMissing: string): string {
    const summary = sectionText(document ?? "", "Summary")?.trim() ?? "";

    return summary === "" ? whenMissing : summary;
}

function sourced(document: string | null, source: string): readonly SourcedFinding[] {
    return reviewFindings(document ?? "").map((finding) => ({ ...finding, source }));
}

function findingsText(findings: readonly SourcedFinding[]): string {
    if (findings.length === 0) {
        return "No findings.";
    }

    const accepted = findings.filter((finding) => ACCEPTED.test(finding.status));
    const unresolved = findings.filter((finding) => !FIXED.test(finding.status) && !ACCEPTED.test(finding.status));

    if (accepted.length === 0 && unresolved.length === 0) {
        return "Every finding was fixed.";
    }

    const lists = [
        ["Accepted instead of fixed:", accepted],
        ["Not fixed or accepted:", unresolved],
    ] as const;

    return lists
        .filter(([, list]) => list.length > 0)
        .map(([title, list]) => `${title}\n\n${list.map(findingItem).join("\n")}`)
        .join("\n\n");
}

const findingItem = (finding: SourcedFinding): string =>
    `- **${finding.severity}**, ${finding.source} #${finding.id}: ${finding.finding} (${finding.where}). ${finding.status}`;

function decisionsSection(records: readonly DecisionRecord[]): string {
    const items = records.map(
        (record) =>
            `- ${record.title} (\`${record.file.replace(FILE_NAME_BREAKING, "?")}\`)${record.isProposed ? " — Proposed" : ""}`,
    );

    return `## Decisions\n\n${items.length === 0 ? "No new decision records." : items.join("\n")}`;
}

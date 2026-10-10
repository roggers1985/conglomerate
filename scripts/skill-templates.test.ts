import { describe, expect, it } from "bun:test";
import path from "node:path";
import { readText, TEXT_BYTES_MAX } from "../lib/files.ts";
import {
    intentProblems,
    migrationPlanProblems,
    planProblems,
    reviewProblems,
    specProblems,
    taskListProblems,
    verificationProblems,
} from "../plugins/factory/scripts/stage-gates.ts";

// The templates in the stage skills must pass their own stage gates, so rewriting their guidance can't break a
// heading, a field or a format that a gate parses (ADR 0052 to 0055).

const SKILLS_DIR = path.join(import.meta.dir, "..", "plugins", "factory", "skills");
const TEMPLATE_BLOCK = /^```markdown\n([\s\S]*?)^```$/gm;
const CRITERION_ID = /\bAC-\d+\b/g;

/** The ```markdown blocks of a skill, in order; fails when the skill doesn't have exactly `count` of them. */
async function templates(skill: string, { count }: { readonly count: number }): Promise<readonly string[]> {
    const markdown = await readText(path.join(SKILLS_DIR, skill, "SKILL.md"), {
        maxBytes: TEXT_BYTES_MAX,
        signal: AbortSignal.timeout(5_000),
        symbolicLinks: "follow",
    });
    const blocks = [...markdown.matchAll(TEMPLATE_BLOCK)].map((match) => match[1] ?? "");

    expect(blocks, `${skill} should have ${count} \`\`\`markdown template block(s)`).toHaveLength(count);

    return blocks;
}

/** The criteria ids named on a template's lines that start with `prefix`, as the spec's active criteria. */
function criteriaNamed(template: string, { prefix }: { readonly prefix: RegExp }): { active: string[]; dropped: [] } {
    const ids = template
        .split("\n")
        .filter((line) => prefix.test(line))
        .flatMap((line) => [...line.matchAll(CRITERION_ID)].map((match) => match[0]));
    const active = [...new Set(ids)];

    expect(active.length, "the template should name at least one criterion").toBeGreaterThan(0);

    return { active, dropped: [] };
}

describe("the stage skills' templates", () => {
    it("AC-5: the intake skill's intent template passes the intent gate", async () => {
        const [intent = ""] = await templates("factory-intake", { count: 2 });

        expect(intentProblems(intent)).toEqual([]);
    });

    it("AC-5: the intake skill's spec template passes the spec gate", async () => {
        const [, spec = ""] = await templates("factory-intake", { count: 2 });

        expect(specProblems(spec, { needsProblem: false })).toEqual([]);
    });

    it("AC-5: the planning skill's plan template passes the plan gate", async () => {
        const [plan = ""] = await templates("factory-planning", { count: 3 });

        expect(planProblems(plan, { hasTasksSection: false })).toEqual([]);
    });

    it("AC-5: the planning skill's tasks template passes the task list gate", async () => {
        const [, tasks = ""] = await templates("factory-planning", { count: 3 });
        const criteria = criteriaNamed(tasks, { prefix: /^\s*[-*] Covers:/ });

        expect(taskListProblems(tasks, { file: "tasks.md", criteria })).toEqual([]);
    });

    it("AC-4: the planning skill's migration plan template passes the migration plan gate", async () => {
        const [, , migrationPlan = ""] = await templates("factory-planning", { count: 3 });

        expect(migrationPlanProblems(migrationPlan)).toEqual([]);
    });

    it("AC-5: the build skill's verification template passes the verification gate", async () => {
        const [verification = ""] = await templates("factory-build", { count: 1 });
        const criteria = criteriaNamed(verification, { prefix: /^\s*[-*] AC-\d+:/ });

        expect(verificationProblems(verification, { criteria })).toEqual([]);
    });

    it("AC-10: the verification template records the arbiter's rulings", async () => {
        const [verification = ""] = await templates("factory-build", { count: 1 });
        const headings = verification.split("\n").filter((line) => /^## /.test(line));
        const criteria = criteriaNamed(verification, { prefix: /^\s*[-*] AC-\d+:/ });

        expect(headings, "the template should have a `## Rulings` section").toContain("## Rulings");
        expect(headings.indexOf("## Rulings"), "`## Rulings` should come after `## Evidence`").toBeGreaterThan(
            headings.indexOf("## Evidence"),
        );
        expect(
            headings.indexOf("## Evidence"),
            "the template should have an `## Evidence` section",
        ).toBeGreaterThanOrEqual(0);
        expect(verification, "the section should say what to write when no task needed arbitration").toMatch(
            /## Rulings[\s\S]*None\./,
        );
        expect(verificationProblems(verification, { criteria })).toEqual([]);
    });

    it("AC-5: the review skill's review template passes the review gate", async () => {
        const [review = ""] = await templates("factory-review", { count: 1 });

        expect(reviewProblems(review, { file: "review.md" })).toEqual([]);
    });
});

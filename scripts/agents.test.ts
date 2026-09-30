import { describe, expect, it } from "bun:test";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import type { Routes } from "../plugins/factory/scripts/models.ts";
import { renderTaskAgent, renderTaskAgents } from "./agents.ts";

const routes: Routes = {
    "code-small": { model: "haiku", effort: "low", use: "Mechanical edits: renames" },
    review: { model: "opus", effort: "high", use: "Reviewing code" },
};

describe("renderTaskAgent", () => {
    it("carries the task's default model and effort in valid frontmatter", () => {
        expect(
            parseFrontmatter(
                renderTaskAgent("code-small", { model: "haiku", effort: "low", use: "Mechanical edits: renames" }),
            ),
        ).toEqual({
            name: "code-small",
            description:
                'Task agent for "code-small" work: Mechanical edits: renames. Defaults to haiku with low effort (models.json); pass a model to override.',
            model: "haiku",
            effort: "low",
        });
    });

    it("tells the agent to stop and escalate when the task is bigger than its type", () => {
        expect(renderTaskAgent("review", { model: "opus", effort: "high", use: "Reviewing code" })).toContain(
            "stop and say so instead of pushing on",
        );
    });
});

describe("renderTaskAgents", () => {
    it("renders one agent file per task type", () => {
        expect([...renderTaskAgents(routes).keys()]).toEqual(["code-small.md", "review.md"]);
    });
});

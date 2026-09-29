import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Routes } from "../plugins/factory/scripts/models.ts";
import { readTaskAgents, renderTaskAgent, renderTaskAgents, TASK_AGENTS_DIR, taskAgentErrors } from "./agents.ts";
import { parseFrontmatter } from "./skills.ts";

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

describe("taskAgentErrors", () => {
    const expected = renderTaskAgents(routes);

    it("finds nothing when the agents match models.json", () => {
        expect(taskAgentErrors(expected, expected)).toEqual([]);
    });

    it("reports missing, stale and orphaned agents", () => {
        const actual = new Map([
            ["review.md", "edited by hand"],
            ["writing.md", "no longer in models.json"],
        ]);

        expect(taskAgentErrors(expected, actual)).toEqual([
            `${TASK_AGENTS_DIR}/code-small.md is missing or out of date: run \`bun run generate\``,
            `${TASK_AGENTS_DIR}/review.md is missing or out of date: run \`bun run generate\``,
            `${TASK_AGENTS_DIR}/writing.md has no task in models.json: run \`bun run generate\``,
        ]);
    });
});

describe("readTaskAgents", () => {
    let pluginDir = "";

    afterEach(async () => {
        await rm(pluginDir, { recursive: true, force: true });
    });

    it("reads the generated agent files of a plugin", async () => {
        pluginDir = await mkdtemp(path.join(tmpdir(), "plugin-"));
        await Bun.write(path.join(pluginDir, TASK_AGENTS_DIR, "review.md"), "content");

        expect(await readTaskAgents(pluginDir)).toEqual(new Map([["review.md", "content"]]));
    });

    it("treats a plugin without task agents as having none", async () => {
        pluginDir = await mkdtemp(path.join(tmpdir(), "plugin-"));

        expect(await readTaskAgents(pluginDir)).toEqual(new Map());
    });
});

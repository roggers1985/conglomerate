import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { generatedFileErrors, readGeneratedFiles } from "./generated.ts";

describe("readGeneratedFiles", () => {
    let dir = "";

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("reads the files with the given extension, sorted by name", async () => {
        dir = await mkdtemp(path.join(tmpdir(), "generated-"));
        await Promise.all([
            Bun.write(path.join(dir, "b.js"), "b"),
            Bun.write(path.join(dir, "a.js"), "a"),
            Bun.write(path.join(dir, "a.js.map"), "map"),
        ]);

        expect([...(await readGeneratedFiles(dir, { extension: ".js" }))]).toEqual([
            ["a.js", "a"],
            ["b.js", "b"],
        ]);
    });

    it("treats a folder that doesn't exist yet as empty", async () => {
        dir = await mkdtemp(path.join(tmpdir(), "generated-"));

        expect(await readGeneratedFiles(path.join(dir, "dist"), { extension: ".js" })).toEqual(new Map());
    });
});

describe("generatedFileErrors", () => {
    const expected = new Map([
        ["a.md", "current a"],
        ["b.md", "current b"],
    ]);

    it("finds nothing when the files match", () => {
        expect(generatedFileErrors(expected, expected, { label: "agents/tasks" })).toEqual([]);
    });

    it("reports missing, stale and orphaned files", () => {
        const actual = new Map([
            ["b.md", "edited by hand"],
            ["c.md", "no longer generated"],
        ]);

        expect(generatedFileErrors(expected, actual, { label: "agents/tasks" })).toEqual([
            "agents/tasks/a.md is missing or out of date: run `bun run generate`",
            "agents/tasks/b.md is missing or out of date: run `bun run generate`",
            "agents/tasks/c.md is no longer generated: run `bun run generate`",
        ]);
    });
});

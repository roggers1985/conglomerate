import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
    AUTONOMY_LEVELS,
    parseFactorySettings,
    readAutonomyRules,
    readProjectAutonomy,
    renderAutonomyContext,
} from "./autonomy.ts";

const signal = AbortSignal.timeout(5_000);

describe("parseFactorySettings", () => {
    it("accepts every autonomy level", () => {
        for (const autonomy of AUTONOMY_LEVELS) {
            expect(parseFactorySettings({ autonomy })).toEqual({ kind: "valid", value: { autonomy } });
        }
    });

    it("rejects an unknown level, a missing level and unknown keys", () => {
        expect(parseFactorySettings({ autonomy: "full" }).kind).toBe("invalid");
        expect(parseFactorySettings({}).kind).toBe("invalid");
        expect(parseFactorySettings({ autonomy: "guided", autonmy: "trusted" }).kind).toBe("invalid");
    });
});

describe("readProjectAutonomy", () => {
    let dir = "";
    const writeSettings = (content: string): Promise<number> =>
        Bun.write(path.join(dir, ".claude/factory.json"), content);

    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), "autonomy-"));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("uses the default level, guided, when the project sets none", async () => {
        expect(await readProjectAutonomy(dir, { signal })).toEqual({ kind: "default", level: "guided" });
    });

    it("uses the project's level", async () => {
        await writeSettings('{ "autonomy": "autonomous" }');

        expect(await readProjectAutonomy(dir, { signal })).toEqual({ kind: "project", level: "autonomous" });
    });

    it("falls back to guided when the level is unknown, and says why", async () => {
        await writeSettings('{ "autonomy": "full" }');

        const autonomy = await readProjectAutonomy(dir, { signal });

        expect(autonomy.kind).toBe("invalid");
        expect(autonomy.level).toBe("guided");
    });

    it("falls back to guided when the file isn't JSON", async () => {
        await writeSettings("{ autonomy: trusted");

        expect(await readProjectAutonomy(dir, { signal })).toEqual({
            kind: "invalid",
            level: "guided",
            errors: ["is not valid JSON"],
        });
    });

    it("stops when aborted", async () => {
        await writeSettings('{ "autonomy": "trusted" }');

        await expect(readProjectAutonomy(dir, { signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });
});

describe("readAutonomyRules", () => {
    it("has non-empty rules for every level", async () => {
        const rules = await Promise.all(AUTONOMY_LEVELS.map((level) => readAutonomyRules(level, { signal })));

        expect(rules.every((text) => text.trim().length > 0)).toBe(true);
    });
});

describe("renderAutonomyContext", () => {
    it("names the level, where it comes from, and its rules", () => {
        expect(renderAutonomyContext({ kind: "project", level: "trusted" }, { rules: "Rules.\n" })).toBe(
            "## Autonomy: trusted\n\nThis session runs at the `trusted` level (set in `.claude/factory.json`).\n\nRules.",
        );
    });

    it("says when the level is the default", () => {
        expect(renderAutonomyContext({ kind: "default", level: "guided" }, { rules: "Rules." })).toContain(
            "(the default; a project sets its own in `.claude/factory.json`)",
        );
    });

    it("lists the problems of an invalid settings file", () => {
        const section = renderAutonomyContext(
            { kind: "invalid", level: "guided", errors: ["autonomy: must be one of guided, trusted, autonomous"] },
            { rules: "Rules." },
        );

        expect(section).toContain("(the default, because `.claude/factory.json` is invalid)");
        expect(section).toContain("- autonomy: must be one of guided, trusted, autonomous");
    });
});

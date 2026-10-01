import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
    AUTONOMY_LEVELS,
    DEFAULT_SETTINGS,
    factorySettingsJsonSchema,
    LIMITS,
    parseFactorySettings,
    readFactorySettings,
    renderSettingsContext,
} from "./settings.ts";

const signal = AbortSignal.timeout(5_000);

const settingsOf = (input: unknown) => {
    const parsed = parseFactorySettings(input);

    return parsed.kind === "valid" ? parsed.value : null;
};

describe("parseFactorySettings", () => {
    it("fills in every default for an empty file", () => {
        expect(settingsOf({})).toEqual(DEFAULT_SETTINGS);
    });

    it("accepts every autonomy level, and marks it as the project's own", () => {
        for (const autonomy of AUTONOMY_LEVELS) {
            expect(settingsOf({ autonomy })?.autonomy).toBe(autonomy);
            expect(settingsOf({ autonomy })?.own.has("autonomy")).toBe(true);
        }
    });

    it("takes the limits a project sets, and the defaults for the rest", () => {
        const settings = settingsOf({ limits: { reviewRounds: 5 } });

        expect(settings?.limits).toEqual({ ...DEFAULT_SETTINGS.limits, reviewRounds: 5 });
        expect([...(settings?.own ?? [])]).toEqual(["reviewRounds"]);
    });

    it("accepts every limit at its bounds, and refuses one past them", () => {
        for (const [name, limit] of Object.entries(LIMITS)) {
            expect(settingsOf({ limits: { [name]: limit.min } })).not.toBeNull();
            expect(settingsOf({ limits: { [name]: limit.max } })).not.toBeNull();
            expect(parseFactorySettings({ limits: { [name]: limit.min - 1 } }).kind).toBe("invalid");
            expect(parseFactorySettings({ limits: { [name]: limit.max + 1 } }).kind).toBe("invalid");
        }
    });

    it("refuses a limit that isn't a whole number, an unknown level, and unknown keys", () => {
        expect(parseFactorySettings({ limits: { reviewRounds: 2.5 } }).kind).toBe("invalid");
        expect(parseFactorySettings({ autonomy: "full" }).kind).toBe("invalid");
        expect(parseFactorySettings({ autonmy: "trusted" }).kind).toBe("invalid");
        expect(parseFactorySettings({ limits: { reviewRound: 4 } }).kind).toBe("invalid");
    });

    it("allows a $schema reference for editors", () => {
        expect(settingsOf({ $schema: "./factory.schema.json", autonomy: "trusted" })?.autonomy).toBe("trusted");
    });
});

describe("readFactorySettings", () => {
    let dir = "";
    const writeSettings = (content: string): Promise<number> =>
        Bun.write(path.join(dir, ".claude/factory.json"), content);

    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), "settings-"));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("uses the defaults when the project has no settings file", async () => {
        expect(await readFactorySettings(dir, { signal })).toEqual({ kind: "default", settings: DEFAULT_SETTINGS });
    });

    it("uses the project's settings", async () => {
        await writeSettings('{ "autonomy": "autonomous", "limits": { "parallelTasks": 1 } }');

        const project = await readFactorySettings(dir, { signal });

        expect(project.kind).toBe("project");
        expect(project.settings.autonomy).toBe("autonomous");
        expect(project.settings.limits.parallelTasks).toBe(1);
    });

    it("falls back to the defaults, including guided, when the file is invalid, and says why", async () => {
        await writeSettings('{ "autonomy": "autonomous", "limits": { "reviewRounds": 0 } }');

        const project = await readFactorySettings(dir, { signal });

        expect(project.kind).toBe("invalid");
        expect(project.settings).toEqual(DEFAULT_SETTINGS);
    });

    it("falls back to the defaults when the file isn't JSON", async () => {
        await writeSettings("{ autonomy: trusted");

        expect(await readFactorySettings(dir, { signal })).toEqual({
            kind: "invalid",
            settings: DEFAULT_SETTINGS,
            errors: ["is not valid JSON"],
        });
    });

    it("stops when aborted", async () => {
        await writeSettings('{ "autonomy": "trusted" }');

        await expect(readFactorySettings(dir, { signal: AbortSignal.abort() })).rejects.toMatchObject({
            name: "AbortError",
        });
    });
});

describe("renderSettingsContext", () => {
    it("lists every limit with its value, where it comes from, and what it limits", () => {
        const settings = settingsOf({ limits: { reviewRounds: 5 } }) ?? DEFAULT_SETTINGS;
        const section = renderSettingsContext(settings);

        expect(section).toStartWith("## Factory settings\n");
        expect(section).toContain("| `reviewRounds` | 5 (set by the project) | review rounds per change");
        expect(section).toContain("| `parallelTasks` | 3 (default) |");
    });
});

describe("factorySettingsJsonSchema", () => {
    it("describes the same file the plugin parses: strict, with the bounds and the levels", () => {
        const schema = JSON.parse(factorySettingsJsonSchema());

        expect(schema.additionalProperties).toBe(false);
        expect(schema.properties.autonomy.enum).toEqual([...AUTONOMY_LEVELS]);
        expect(schema.properties.limits.additionalProperties).toBe(false);
        expect(schema.properties.limits.properties.subagentsPerTask).toMatchObject({ minimum: 1, maximum: 50 });
    });
});

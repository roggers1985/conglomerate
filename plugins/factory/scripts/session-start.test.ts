import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { readJson } from "../../../lib/files.ts";
import { parse } from "../../../lib/parse.ts";
import { readRoutes, renderRoutingContext } from "./models.ts";
import {
    buildSessionStartOutput,
    CORE_CONVENTIONS_PATH,
    renderSessionStartPart,
    SESSION_START_CONTEXT_CHARACTERS_MAX,
    SESSION_START_PARTS,
} from "./session-start.ts";
import { readFactorySettings, renderSettingsContext } from "./settings.ts";

const LEVELS = ["guided", "trusted", "autonomous"] as const;
const AUTONOMY_DIR = path.resolve(import.meta.dir, "..", "conventions", "autonomy");
const SCRIPT_PATH = path.join(import.meta.dir, "session-start.ts");

// Over the 1 MiB the settings reader accepts, so the autonomy part cannot be produced.
const OVERSIZE_SETTINGS = " ".repeat(1_100_000);

const signal = (): AbortSignal => AbortSignal.timeout(10_000);

describe("session-start parts", () => {
    let projectDir = "";

    beforeEach(async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "session-start-"));
    });

    afterEach(async () => {
        await rm(projectDir, { recursive: true, force: true });
    });

    const setSettings = (content: string): Promise<number> =>
        Bun.write(path.join(projectDir, ".claude/factory.json"), content);

    const setLevel = (level: string): Promise<number> => setSettings(JSON.stringify({ autonomy: level }));

    const runCommand = async (
        ...args: readonly string[]
    ): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> => {
        const command = Bun.spawn(["bun", SCRIPT_PATH, ...args], {
            stdout: "pipe",
            stderr: "pipe",
            env: Object.fromEntries([
                ["PATH", process.env["PATH"] ?? ""],
                ["HOME", projectDir],
                ["TMPDIR", projectDir],
            ]),
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(command.stdout).text(),
            new Response(command.stderr).text(),
            command.exited,
        ]);

        return { exitCode, stdout, stderr };
    };

    it("AC-2: keeps the autonomy part within the cap when the settings have thousands of unknown keys", async () => {
        const unknown = Object.fromEntries(Array.from({ length: 2_000 }, (_, index) => [`unknown_key_${index}`, 1]));

        await setSettings(JSON.stringify({ autonomy: "trusted", ...unknown }));

        const text = await renderSessionStartPart("autonomy", { projectDir, signal: signal() });

        expect(text.length).toBeLessThanOrEqual(SESSION_START_CONTEXT_CHARACTERS_MAX);
        expect(text).toContain("unknown_key_0");
        expect(text).toContain("…");
    });

    for (const level of LEVELS) {
        for (const part of ["conventions", "autonomy", "routing"] as const) {
            it(`AC-2, AC-5: keeps the ${part} part within the cap at level ${level}`, async () => {
                await setLevel(level);

                const text = await renderSessionStartPart(part, { projectDir, signal: signal() });

                expect(
                    text.length,
                    `part "${part}" at level "${level}" is ${text.length} characters long; the cap is ${SESSION_START_CONTEXT_CHARACTERS_MAX}`,
                ).toBeLessThanOrEqual(SESSION_START_CONTEXT_CHARACTERS_MAX);
            });

            it(`AC-2, AC-5: keeps the ${part} output of the command within the cap at level ${level}`, async () => {
                await setLevel(level);

                const { exitCode, stdout } = await runCommand(part, projectDir);
                const context: string = JSON.parse(stdout).hookSpecificOutput.additionalContext;

                expect(exitCode).toBe(0);
                expect(
                    context.length,
                    `part "${part}" at level "${level}" is ${context.length} characters long; the cap is ${SESSION_START_CONTEXT_CHARACTERS_MAX}`,
                ).toBeLessThanOrEqual(SESSION_START_CONTEXT_CHARACTERS_MAX);
            });
        }
    }

    it("AC-4: keeps the wording of the conventions part equal to the trimmed core.md", async () => {
        const text = await renderSessionStartPart("conventions", { projectDir, signal: signal() });

        expect(text).toBe((await Bun.file(CORE_CONVENTIONS_PATH).text()).trim());
    });

    it("AC-4: keeps the wording of the routing part equal to the rendered routing table", async () => {
        const text = await renderSessionStartPart("routing", { projectDir, signal: signal() });

        expect(text).toBe(renderRoutingContext(await readRoutes({ signal: signal() })).trim());
    });

    for (const level of LEVELS) {
        it(`AC-4: keeps the wording of the autonomy rules at level ${level}`, async () => {
            await setLevel(level);

            const text = await renderSessionStartPart("autonomy", { projectDir, signal: signal() });
            const rules = await Bun.file(path.join(AUTONOMY_DIR, `${level}.md`)).text();

            const project = await readFactorySettings(projectDir, { signal: signal() });

            expect(text).toStartWith(`## Autonomy: ${level}`);
            expect(text).toContain(rules.trim());
            expect(text).toEndWith(`\n\n${renderSettingsContext(project.settings)}`);
            expect(text).toContain("## Factory settings");
        });
    }

    it("names the audience in the autonomy part for a non-programmer, within the cap", async () => {
        await setSettings(JSON.stringify({ autonomy: "autonomous", audience: "non-programmer" }));

        const text = await renderSessionStartPart("autonomy", { projectDir, signal: signal() });

        expect(text).toContain("## Audience: non-programmer");
        expect(text).toContain("factory-non-programmer");
        expect(text.length).toBeLessThanOrEqual(SESSION_START_CONTEXT_CHARACTERS_MAX);
    });

    it("AC-4: prints the conventions part from the command as the hook's JSON", async () => {
        const { exitCode, stdout, stderr } = await runCommand("conventions", projectDir);
        const conventions = (await Bun.file(CORE_CONVENTIONS_PATH).text()).trim();

        expect(exitCode).toBe(0);
        expect(stderr).toBe("");
        expect(JSON.parse(stdout).hookSpecificOutput).toEqual({
            hookEventName: "SessionStart",
            additionalContext: conventions,
        });
    });

    it("AC-4: keeps the default level guided when the settings are malformed JSON", async () => {
        await setSettings("{ not json");

        const { exitCode, stdout } = await runCommand("autonomy", projectDir);

        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout).hookSpecificOutput.additionalContext).toStartWith("## Autonomy: guided");
    });

    it("AC-7: still produces the conventions and routing parts when the settings cannot be read", async () => {
        await setSettings(OVERSIZE_SETTINGS);

        const conventions = await runCommand("conventions", projectDir);
        const routing = await runCommand("routing", projectDir);

        expect(conventions.exitCode, "conventions part exits with 0").toBe(0);
        expect(routing.exitCode, "routing part exits with 0").toBe(0);
    });

    it("AC-7: tells the owner that the autonomy part is missing when the settings cannot be read", async () => {
        await setSettings(OVERSIZE_SETTINGS);

        const { exitCode, stdout, stderr } = await runCommand("autonomy", projectDir);

        expect(exitCode).not.toBe(0);
        expect(stdout).toBe("");
        expect(stderr).toContain("autonomy");
        expect(stderr).toContain("over the limit of 1048576 bytes");
    });

    it("AC-7: rejects with an error that names the autonomy part when the settings cannot be read", async () => {
        await setSettings(OVERSIZE_SETTINGS);

        const rendering = renderSessionStartPart("autonomy", { projectDir, signal: signal() });

        await expect(rendering).rejects.toThrow(/autonomy/);
    });

    it("AC-7: exits non-zero and names the part when the part is unknown", async () => {
        const { exitCode, stdout, stderr } = await runCommand("nonsense", projectDir);

        expect(exitCode).not.toBe(0);
        expect(stdout).toBe("");
        expect(stderr).toContain("nonsense");
    });
});

describe("buildSessionStartOutput", () => {
    it("AC-4: wraps one part's text in the hook's JSON without changing it", () => {
        const output = buildSessionStartOutput("# Conventions\n\nText.");

        expect(output).toEqual({
            hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "# Conventions\n\nText." },
        });
    });

    it("AC-7: refuses empty text, so a missing part is never delivered as an empty one", () => {
        expect(() => buildSessionStartOutput("  \n")).toThrow();
    });
});

const HOOKS_PATH = path.resolve(import.meta.dir, "..", "hooks", "hooks.json");
const HOOKS_BYTES_MAX = 64 * 1024;
const SESSION_START_SCRIPT = `"\${CLAUDE_PLUGIN_ROOT}/dist/session-start.js"`;
const REMINDER_COMMANDS = [
    `bun "\${CLAUDE_PLUGIN_ROOT}/dist/checkups.js" reminder`,
    `bun "\${CLAUDE_PLUGIN_ROOT}/dist/toolbox.js" reminder`,
    `bun "\${CLAUDE_PLUGIN_ROOT}/dist/changes.js" reminder`,
] as const;

const HooksSchema = z.object({
    hooks: z.record(
        z.string(),
        z.array(z.object({ hooks: z.array(z.object({ type: z.string(), command: z.string() })) })),
    ),
});

describe("hooks.json session-start commands", () => {
    const readSessionStartCommands = async (): Promise<readonly (readonly string[])[]> => {
        const json = await readJson(HOOKS_PATH, {
            maxBytes: HOOKS_BYTES_MAX,
            signal: signal(),
            symbolicLinks: "follow",
        });
        const parsed = parse(HooksSchema, json);

        if (parsed.kind === "invalid") {
            throw new Error(`hooks.json is invalid: ${parsed.errors.join("; ")}`);
        }

        const groups = parsed.value.hooks["SessionStart"] ?? [];

        return groups.map((group) => group.hooks.map((hook) => hook.command));
    };

    it("AC-1: runs one session-start command per part, each with the part as its first argument", async () => {
        const groups = await readSessionStartCommands();
        const sessionStartCommands = groups.flat().filter((command) => command.includes("session-start.js"));

        expect(sessionStartCommands).toEqual(SESSION_START_PARTS.map((part) => `bun ${SESSION_START_SCRIPT} ${part}`));
    });

    it("AC-1: keeps the three session-start commands in the same hook group, before the reminders", async () => {
        const groups = await readSessionStartCommands();

        expect(groups).toEqual([
            [...SESSION_START_PARTS.map((part) => `bun ${SESSION_START_SCRIPT} ${part}`), ...REMINDER_COMMANDS],
        ]);
    });

    it("AC-3: orders the parts conventions, autonomy, routing in the hook configuration", async () => {
        const groups = await readSessionStartCommands();
        const parts = groups
            .flat()
            .filter((command) => command.includes("session-start.js"))
            .map((command) => command.split(" ").at(-1));

        expect(parts).toEqual(["conventions", "autonomy", "routing"]);
    });
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readRoutes, renderRoutingContext } from "./models.ts";
import {
    buildSessionStartOutput,
    CORE_CONVENTIONS_PATH,
    renderSessionStartPart,
    SESSION_START_CONTEXT_CHARACTERS_MAX,
    SESSION_START_PARTS,
} from "./session-start.ts";

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
            env: { PATH: process.env["PATH"] ?? "", HOME: projectDir, TMPDIR: projectDir },
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(command.stdout).text(),
            new Response(command.stderr).text(),
            command.exited,
        ]);

        return { exitCode, stdout, stderr };
    };

    it("AC-2: names the three parts in the order conventions, autonomy, routing", () => {
        expect(SESSION_START_PARTS).toEqual(["conventions", "autonomy", "routing"]);
        expect(SESSION_START_CONTEXT_CHARACTERS_MAX).toBe(10_000);
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

            expect(text).toStartWith(`## Autonomy: ${level}`);
            expect(text).toContain(rules.trim());
        });
    }

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

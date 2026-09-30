import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Routes } from "./models.ts";
import { readRoutes, renderRoutingContext } from "./models.ts";
import { buildSessionStartOutput, CORE_CONVENTIONS_PATH } from "./session-start.ts";

const routes: Routes = { code: { model: "sonnet", effort: "medium", use: "Everyday work" } };
const autonomy = "## Autonomy: guided\n\nThe owner decides.";

describe("buildSessionStartOutput", () => {
    it("passes the conventions, the autonomy level and the model routing to Claude, in that order", () => {
        const { additionalContext } = buildSessionStartOutput("# Conventions\n", routes, {
            autonomy,
        }).hookSpecificOutput;

        expect(additionalContext).toStartWith(
            "# Conventions\n\n## Autonomy: guided\n\nThe owner decides.\n\n## Model routing",
        );
        expect(additionalContext).toContain("| `code` | sonnet | medium | Everyday work |");
    });

    it("refuses empty conventions or an empty autonomy section", () => {
        expect(() => buildSessionStartOutput("  \n", routes, { autonomy })).toThrow(
            "core conventions must not be empty",
        );
        expect(() => buildSessionStartOutput("# Conventions", routes, { autonomy: " " })).toThrow(
            "the autonomy section must not be empty",
        );
    });
});

describe("session-start hook", () => {
    let projectDir = "";

    afterEach(async () => {
        await rm(projectDir, { recursive: true, force: true });
    });

    const runHook = async (dir: string): Promise<{ readonly exitCode: number; readonly context: string }> => {
        const hook = Bun.spawn(["bun", path.join(import.meta.dir, "session-start.ts"), dir], { stdout: "pipe" });
        const [stdout, exitCode] = await Promise.all([new Response(hook.stdout).text(), hook.exited]);

        return { exitCode, context: JSON.parse(stdout).hookSpecificOutput.additionalContext };
    };

    it("prints the core conventions, the default autonomy level and the model routing as hook output", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "session-start-"));
        const { exitCode, context } = await runHook(projectDir);
        const conventions = await Bun.file(CORE_CONVENTIONS_PATH).text();

        expect(exitCode).toBe(0);
        expect(context).toContain(conventions.trim());
        expect(context).toContain("## Autonomy: guided");
        expect(context).toContain(renderRoutingContext(await readRoutes({ signal: AbortSignal.timeout(5_000) })));
    });

    it("uses the level the project sets in .claude/factory.json", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "session-start-"));
        await Bun.write(path.join(projectDir, ".claude/factory.json"), '{ "autonomy": "autonomous" }');

        const { context } = await runHook(projectDir);

        expect(context).toContain("## Autonomy: autonomous");
        expect(context).toContain("You run the work end to end");
    });
});

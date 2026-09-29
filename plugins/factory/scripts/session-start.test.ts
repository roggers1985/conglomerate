import { describe, expect, it } from "bun:test";
import path from "node:path";
import type { Routes } from "./models.ts";
import { readRoutes, renderRoutingContext } from "./models.ts";
import { buildSessionStartOutput, CORE_CONVENTIONS_PATH } from "./session-start.ts";

const routes: Routes = { code: { model: "sonnet", effort: "medium", use: "Everyday work" } };

describe("buildSessionStartOutput", () => {
    it("passes the conventions and the model routing to Claude as session context", () => {
        const { additionalContext } = buildSessionStartOutput("# Conventions\n", routes).hookSpecificOutput;

        expect(additionalContext).toStartWith("# Conventions\n\n## Model routing");
        expect(additionalContext).toContain("| `code` | sonnet | medium | Everyday work |");
    });

    it("refuses empty conventions", () => {
        expect(() => buildSessionStartOutput("  \n", routes)).toThrow(/must not be empty/);
    });
});

describe("session-start hook", () => {
    it("prints the core conventions and the plugin's model routing as hook output", async () => {
        const hook = Bun.spawn(["bun", path.join(import.meta.dir, "session-start.ts")], { stdout: "pipe" });
        const [stdout, exitCode] = await Promise.all([new Response(hook.stdout).text(), hook.exited]);
        const conventions = await Bun.file(CORE_CONVENTIONS_PATH).text();
        const { additionalContext } = JSON.parse(stdout).hookSpecificOutput;

        expect(exitCode).toBe(0);
        expect(additionalContext).toContain(conventions.trim());
        expect(additionalContext).toContain(
            renderRoutingContext(await readRoutes({ signal: AbortSignal.timeout(5_000) })),
        );
    });
});

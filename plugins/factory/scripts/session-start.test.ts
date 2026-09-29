import { describe, expect, it } from "bun:test";
import path from "node:path";
import { buildSessionStartOutput, CORE_CONVENTIONS_PATH } from "./session-start.ts";

describe("buildSessionStartOutput", () => {
    it("passes the conventions to Claude as additional session context", () => {
        expect(buildSessionStartOutput("# Conventions")).toEqual({
            hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "# Conventions" },
        });
    });

    it("refuses empty conventions", () => {
        expect(() => buildSessionStartOutput("  \n")).toThrow(/must not be empty/);
    });
});

describe("session-start hook", () => {
    it("prints the core conventions file as hook output", async () => {
        const hook = Bun.spawn(["bun", path.join(import.meta.dir, "session-start.ts")], { stdout: "pipe" });
        const [stdout, exitCode] = await Promise.all([new Response(hook.stdout).text(), hook.exited]);
        const conventions = await Bun.file(CORE_CONVENTIONS_PATH).text();

        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual(buildSessionStartOutput(conventions));
    });
});

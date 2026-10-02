import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

// The setup file only applies to a `bun test` started inside this repository (bunfig.toml), so the fixtures are
// written to a folder below the root, run in a subprocess, and removed again.
const ROOT = path.join(import.meta.dir, "..");
const SUBPROCESS_TIMEOUT_MS = 30_000;

let folder = "";

beforeEach(async () => {
    folder = await mkdtemp(path.join(ROOT, ".test-fixtures-"));
});

afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
});

/** Runs `bun test` on a fixture test file, with both streams captured. */
async function runFixture(source: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const file = path.join(folder, "fixture.test.ts");

    await Bun.write(file, source);

    const run = Bun.spawn(["bun", "test", file], {
        cwd: ROOT,
        stdout: "pipe",
        stderr: "pipe",
        timeout: SUBPROCESS_TIMEOUT_MS,
    });
    const [stdout, stderr, exitCode] = await Promise.all([run.stdout.text(), run.stderr.text(), run.exited]);

    return { exitCode, stdout, stderr };
}

const IMPORTS = `import { expect, it } from "bun:test";
import { expectConsole } from "${path.join(ROOT, "lib/console-capture.ts")}";
`;

describe("the test setup (clean test output)", () => {
    it("passes a test that prints nothing", async () => {
        const result = await runFixture(`${IMPORTS}it("quiet", () => { expect(1).toBe(1); });`);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toContain("1 pass");
    });

    it("passes a test that expects its output, and prints none of it", async () => {
        const result = await runFixture(
            `${IMPORTS}it("noisy", () => {
                console.warn("careful", 42);
                console.log("hello");
                expectConsole("warn", /careful 42/);
                expectConsole("log", "hello");
            });`,
        );

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toContain("1 pass");
        expect(result.stdout).not.toContain("hello");
        expect(result.stderr).not.toContain("careful");
    });

    it("fails a test that logs unexpectedly, naming the output, and keeps it off the terminal", async () => {
        const result = await runFixture(`${IMPORTS}it("noisy", () => { console.log("surprise"); });`);

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("Test output is not clean");
        expect(result.stderr).toContain("console.log: surprise");
        expect(result.stderr).toContain("1 fail");
        expect(result.stdout).not.toContain("surprise");
    });

    it.each(["info", "warn", "error", "debug"] as const)("fails a test that calls console.%s", async (method) => {
        const result = await runFixture(`${IMPORTS}it("noisy", () => { console.${method}("unexpected"); });`);

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain(`console.${method}: unexpected`);
    });

    it("fails a test that expects output that was not printed", async () => {
        const result = await runFixture(`${IMPORTS}it("silent", () => { expectConsole("warn", "missing"); });`);

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("expected console.warn matching missing");
    });

    it("fails a test on an output it only partly expected", async () => {
        const result = await runFixture(
            `${IMPORTS}it("two", () => {
                console.warn("one");
                console.warn("two");
                expectConsole("warn", "one");
            });`,
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("console.warn: two");
        expect(result.stderr).not.toContain("console.warn: one");
    });

    it("fails a test during which a promise was rejected and not handled", async () => {
        const result = await runFixture(
            `${IMPORTS}it("rejects", async () => {
                Promise.reject(new Error("nobody listens"));
                await new Promise((resolve) => setTimeout(resolve, 20));
            });`,
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("1 fail");
        expect(result.stderr).toContain("nobody listens");
    });

    it("fails a test during which an exception was thrown outside of it", async () => {
        const result = await runFixture(
            `${IMPORTS}it("throws later", async () => {
                setTimeout(() => { throw new Error("from a timer"); }, 0);
                await new Promise((resolve) => setTimeout(resolve, 20));
            });`,
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("from a timer");
    });

    it("keeps a failing test from affecting the next one", async () => {
        const result = await runFixture(
            `${IMPORTS}it("noisy", () => { console.log("first"); });
            it("quiet", () => { expect(1).toBe(1); });`,
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain("1 pass");
        expect(result.stderr).toContain("1 fail");
        expect(result.stderr.match(/console\.log: first/g)).toHaveLength(1);
    });
});

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// The setup file only applies to a `bun test` started inside this repository (bunfig.toml), so the fixtures are
// written to a folder below the root, run in a subprocess, and removed again.
const ROOT = path.join(import.meta.dir, "..");
const SUBPROCESS_TIMEOUT_MS = 30_000;

let folder = "";
let home = "";

beforeEach(async () => {
    folder = await mkdtemp(path.join(ROOT, ".test-fixtures-"));
    home = await mkdtemp(path.join(tmpdir(), "setup-test-home-"));
});

afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
});

/**
 * The environment of every fixture subprocess, explicit so that it behaves the same on every machine: Bun changes its
 * output when it sees CI or GitHub Actions variables (on GitHub Actions it repeats errors as annotations). Nothing is
 * inherited; Bun needs only a `PATH`, a home folder and a temporary folder.
 */
function fixtureEnvironment(extra: Record<string, string>): Record<string, string> {
    return {
        // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase by convention.
        HOME: home,
        // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase by convention.
        PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
        // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase by convention.
        TMPDIR: home,
        ...extra,
    };
}

/** The setup's own error block: from its "Test output is not clean" line to the stack line that ends the message. */
function setupReport(stderr: string): string {
    const lines = stderr.split("\n");
    const start = lines.findIndex((line) => line.startsWith("error: Test output is not clean"));

    if (start === -1) {
        return "";
    }

    const length = lines.slice(start).findIndex((line) => /^\s+at /.test(line));

    return lines.slice(start, length === -1 ? undefined : start + length).join("\n");
}

/** Runs `bun test` on a fixture test file, with both streams captured. */
async function runFixture(
    source: string,
    helpers: Record<string, string> = {},
    extraEnvironment: Record<string, string> = {},
): Promise<{ exitCode: number; stdout: string; stderr: string; report: string }> {
    const file = path.join(folder, "fixture.test.ts");

    await Bun.write(file, source);

    for (const [name, helperSource] of Object.entries(helpers)) {
        await Bun.write(path.join(folder, name), helperSource);
    }

    const run = Bun.spawn([process.execPath, "test", file], {
        cwd: ROOT,
        env: fixtureEnvironment(extraEnvironment),
        stdout: "pipe",
        stderr: "pipe",
        timeout: SUBPROCESS_TIMEOUT_MS,
    });
    const [stdout, stderr, exitCode] = await Promise.all([run.stdout.text(), run.stderr.text(), run.exited]);

    return { exitCode, stdout, stderr, report: setupReport(stderr) };
}

// Two lines: fixture code starts on line 3.
const IMPORTS = `import { expect, it } from "bun:test";
import { expectConsole } from "${path.join(ROOT, "lib/console-capture.ts")}";
`;

/** Puts an environment variable of this process back as it was (`undefined` removes it). */
function restore(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

/** The fixture folder as the failure shows it: relative to the repository root. */
const shown = (file: string): string => path.join(path.basename(folder), file);
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
        expect(result.report).toContain("Test output is not clean");
        expect(result.report).toContain(`console.log in test "noisy" (${shown("fixture.test.ts")}:3:`);
        expect(result.report).toContain('"surprise"');
        expect(result.stderr).toContain("1 fail");
        expect(result.stdout).not.toContain("surprise");
    });

    it("names the helper that logged, the test with its enclosing describes, and the test file", async () => {
        const result = await runFixture(
            `${IMPORTS}import { describe } from "bun:test";
import { noisyHelper } from "./helper.ts";
describe("parsing", () => {
    it("calls a helper", () => {
        noisyHelper();
    });
});`,
            { "helper.ts": `export function noisyHelper(): void {\n    console.warn("from the helper");\n}\n` },
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.report).toContain(
            `console.warn at ${shown("helper.ts")}:2:13 in test "parsing › calls a helper" (${shown("fixture.test.ts")}:7:`,
        );
        expect(result.report).toContain('"from the helper"');
        expect(result.stderr).toContain("(fail) parsing > calls a helper");
    });

    it("names the test and its file for a log written directly in the test", async () => {
        const result = await runFixture(`${IMPORTS}it("logs directly", () => {\n    console.error("right here");\n});`);

        expect(result.exitCode).not.toBe(0);
        expect(result.report).toContain(
            `console.error in test "logs directly" (${shown("fixture.test.ts")}:4:13): "right here"`,
        );
        expect(result.report).not.toContain("console.error at");
    });

    it("says so when the test's name is computed and cannot be read from the source", async () => {
        const result = await runFixture(
            `${IMPORTS}const name = "dyn" + "amic";\nit(name, () => { console.log("x"); });`,
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.report).toContain(`console.log in test <name not found> (${shown("fixture.test.ts")}:4:`);
    });

    it("shows one line per unexpected call, cuts long messages and caps the number of calls", async () => {
        const result = await runFixture(
            `${IMPORTS}it("floods", () => { for (let i = 0; i < 25; i++) { console.log("n" + i + "x".repeat(400)); } });`,
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.report).toContain("more characters)");
        expect(result.report).toContain("… and 5 more calls");
        expect(result.report.match(/console\.log in test "floods"/g)).toHaveLength(20);
    });

    it("is not changed by CI variables in the parent's environment: one block, 20 lines", async () => {
        // Bun reports errors differently on GitHub Actions. The fixture's environment is explicit, so these variables,
        // added on purpose to this process's own environment, must not reach it. (On macOS, Bun shows no difference, so
        // this fails there only if the environment stops being explicit; on GitHub Actions it also catches Bun's changes.)
        const ciNames = ["CI", "GITHUB_ACTIONS"] as const;
        const previous = ciNames.map((name) => process.env[name]);

        for (const name of ciNames) {
            process.env[name] = "true";
        }

        try {
            const result = await runFixture(
                `${IMPORTS}it("floods", () => { for (let i = 0; i < 25; i++) { console.log("n" + i); } });`,
            );

            expect(result.stderr.match(/error: Test output is not clean/g)).toHaveLength(1);
            expect(result.report.match(/console\.log in test "floods"/g)).toHaveLength(20);
            expect(result.stderr.match(/console\.log in test "floods"/g)).toHaveLength(20);
        } finally {
            ciNames.forEach((name, index) => {
                restore(name, previous[index]);
            });
        }
    });

    it("passes only the variables it is given to the fixture", async () => {
        const result = await runFixture(
            `${IMPORTS}it("reads", () => { console.log(Object.keys(process.env).sort().join(",")); });`,
            {},
            // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase by convention.
            { SETUP_TEST_MARKER: "1" },
        );

        expect(result.report).toContain("HOME");
        expect(result.report).toContain("SETUP_TEST_MARKER");
        expect(result.report).not.toContain("GITHUB");
        expect(result.report).not.toMatch(/\bCI\b/);
    });

    it("shows the test of what was captured when an expected call is missing", async () => {
        const result = await runFixture(
            `${IMPORTS}it("wrong", () => { console.warn("actual"); expectConsole("error", "actual"); });`,
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain(`console.warn in test \\"wrong\\" (${shown("fixture.test.ts")}:3:`);
    });

    it.each(["info", "warn", "error", "debug"] as const)("fails a test that calls console.%s", async (method) => {
        const result = await runFixture(`${IMPORTS}it("noisy", () => { console.${method}("unexpected"); });`);

        expect(result.exitCode).not.toBe(0);
        expect(result.report).toContain(`console.${method} in test "noisy" (${shown("fixture.test.ts")}:3:`);
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
        expect(result.report).toContain('console.warn in test "two"');
        expect(result.report).toContain('"two"');
        expect(result.report).not.toContain('"one"');
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
        expect(result.report.match(/"first"/g)).toHaveLength(1);
    });
});

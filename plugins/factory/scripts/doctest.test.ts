import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DocumentedExport } from "./doctest.ts";
import { documentationProblems, findDocumentedExports, parseDocComment, renderDoctestFile } from "./doctest.ts";

const FENCE = "```";

const documented = (name: string, code: string, fence = `${FENCE}ts`): string =>
    [
        "/**",
        ` * Does ${name}.`,
        " *",
        " * @param value - The input.",
        " * @example",
        ` * ${fence}`,
        ...code.split("\n").map((line) => ` * ${line}`),
        ` * ${FENCE}`,
        " */",
    ].join("\n");

describe("parseDocComment", () => {
    it("takes the text before the first tag as the summary", () => {
        expect(
            parseDocComment("/**\n * Adds two numbers.\n * Second line.\n *\n * @param a - First.\n */").summary,
        ).toBe("Adds two numbers.\nSecond line.");
    });

    it("collects every fenced example, and marks no-run blocks", () => {
        const comment = `${documented("a", "a();")}\n`.replace(
            " */",
            ` * @example\n * ${FENCE}ts no-run\n * fetch(url);\n * ${FENCE}\n */`,
        );

        expect(parseDocComment(comment).examples).toEqual([
            { code: "a();", run: true },
            { code: "fetch(url);", run: false },
        ]);
    });

    it("does not read decorators or @-lines inside a code block as tags", () => {
        expect(parseDocComment(documented("a", "@decorated\nclass A {}")).examples).toEqual([
            { code: "@decorated\nclass A {}", run: true },
        ]);
    });

    it("reports an @example without a fenced block", () => {
        expect(parseDocComment("/**\n * Adds.\n *\n * @example\n * add(1, 2)\n */").problems).toEqual([
            "@example needs a ```ts fenced code block",
        ]);
    });
});

describe("findDocumentedExports", () => {
    it("finds functions, classes, values and types with their line numbers", () => {
        const source = [
            documented("add", "add(1);"),
            "export async function add(value: number) {}",
            "export const isEven = (value: number): boolean => value % 2 === 0;",
            "export const LIMIT = 3;",
            "export class Stack {}",
            "export type Id = string;",
            "const internal = 1;",
        ].join("\n");

        expect(findDocumentedExports(source).map(({ name, kind, line }) => ({ name, kind, line }))).toEqual([
            { name: "add", kind: "function", line: 10 },
            { name: "isEven", kind: "function", line: 11 },
            { name: "LIMIT", kind: "value", line: 12 },
            { name: "Stack", kind: "class", line: 13 },
            { name: "Id", kind: "type", line: 14 },
        ]);
    });

    it("only takes a comment that sits directly above the export", () => {
        expect(findDocumentedExports("/** Stray. */\n\nexport const a = 1;")[0]?.summary).toBe("");
    });
});

describe("documentationProblems", () => {
    const entry = (overrides: Partial<DocumentedExport>): DocumentedExport => ({
        name: "x",
        kind: "function",
        line: 1,
        summary: "Does x.",
        examples: [{ code: "x();", run: true }],
        problems: [],
        ...overrides,
    });

    it("accepts a documented function with an example", () => {
        expect(documentationProblems(entry({}))).toEqual([]);
    });

    it("requires an example for functions and classes, but not for values and types", () => {
        expect(documentationProblems(entry({ examples: [] }))).toEqual(["x: missing @example"]);
        expect(documentationProblems(entry({ kind: "class", examples: [] }))).toEqual(["x: missing @example"]);
        expect(documentationProblems(entry({ kind: "value", examples: [] }))).toEqual([]);
        expect(documentationProblems(entry({ kind: "type", examples: [] }))).toEqual([]);
    });

    it("requires a summary for every export", () => {
        expect(documentationProblems(entry({ kind: "type", summary: "", examples: [] }))).toEqual([
            "x: missing TSDoc summary",
        ]);
    });
});

describe("renderDoctestFile", () => {
    it("returns null when there is nothing to run", () => {
        expect(renderDoctestFile([], { modulePath: "/m.ts", label: "m.ts" })).toBeNull();
    });
});

describe("doctest CLI", () => {
    const script = path.join(import.meta.dir, "doctest.ts");
    let dir = "";

    const run = async (source: string): Promise<{ readonly exitCode: number; readonly output: string }> => {
        dir = await mkdtemp(path.join(tmpdir(), "doctest-cli-"));
        await Bun.write(path.join(dir, "math.ts"), source);

        const cli = Bun.spawn(["bun", script, dir], { stdout: "pipe", stderr: "pipe", cwd: dir });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(cli.stdout).text(),
            new Response(cli.stderr).text(),
            cli.exited,
        ]);

        return { exitCode, output: stdout + stderr };
    };

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("passes when every example holds", async () => {
        const result = await run(
            `${documented("add", "expect(add(1, 2)).toBe(3);")}\nexport function add(a: number, b: number): number {\n    return a + b;\n}\n`,
        );

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain("1 pass");
    });

    it("fails when an example no longer matches the code", async () => {
        const result = await run(
            `${documented("add", "expect(add(1, 2)).toBe(4);")}\nexport function add(a: number, b: number): number {\n    return a + b;\n}\n`,
        );

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("math.ts › add › example 1");
    });

    it("fails when an exported function has no example", async () => {
        const result = await run(
            "/** Adds. */\nexport function add(a: number, b: number): number {\n    return a + b;\n}\n",
        );

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain("math.ts:2 add: missing @example");
    });
});

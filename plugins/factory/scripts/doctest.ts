// Doctest (ADR 0016): exported code is documented, and every `@example` in its TSDoc runs as a test.
//
//   bun doctest.ts <file|dir>...   check the TSDoc of every exported declaration, then run all examples with `bun test`
//
// Rules: every export has a summary; exported functions and classes have at least one `@example` with a ```ts
// fenced block. Examples run inside a `bun:test` test with the module's exports and `expect` in scope. Mark an
// example ```ts no-run when it can't run in isolation (e.g. it needs the network); prefer runnable examples.

import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { readDirRecursive, readText, TEXT_BYTES_MAX } from "../../../lib/files.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";

/** What kind of declaration an export is, which decides the documentation it needs. */
export type ExportKind = "function" | "class" | "value" | "type";

/** One fenced code block from an `@example` tag. */
export type DocExample = {
    readonly code: string;
    /** False for blocks fenced as ```ts no-run. */
    readonly run: boolean;
};

/** An exported declaration with its parsed TSDoc. */
export type DocumentedExport = {
    readonly name: string;
    readonly kind: ExportKind;
    /** 1-based line of the `export` keyword. */
    readonly line: number;
    readonly summary: string;
    readonly examples: readonly DocExample[];
    /** Problems found while parsing the TSDoc itself, e.g. an `@example` without a fenced block. */
    readonly problems: readonly string[];
};

/** A TSDoc comment split into its summary, examples and problems. */
export type ParsedDoc = Pick<DocumentedExport, "summary" | "examples" | "problems">;

const EXPORT =
    /(?:(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\n)?^export\s+(?:async\s+)?(function|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)(.*)$/gm;
const FUNCTION_INITIALIZER = /^\s*(?::[^=]+)?=\s*(?:async\s+)?(?:<[^>]*>)?(?:\(|[A-Za-z_$][\w$]*\s*=>)/;
const FENCE = /^```(\w+)?(.*)$/;
const TAG = /^@(\w+)/;
const RUNNABLE_LANGUAGES = ["ts", "typescript", "tsx"];
// Every entry below a target, folders included. Other projects run this too: a large source tree has a few
// thousand, this repository about 60.
const SOURCE_ENTRIES_MAX = 100_000;

const KEYWORD_KINDS: Readonly<Record<string, ExportKind>> = {
    function: "function",
    class: "class",
    type: "type",
    interface: "type",
};

function kindOf(keyword: string, rest: string): ExportKind {
    const kind = KEYWORD_KINDS[keyword];

    if (kind !== undefined) {
        return kind;
    }

    return FUNCTION_INITIALIZER.test(rest) ? "function" : "value";
}

function commentLines(comment: string): string[] {
    return comment
        .replace(/^\/\*\*/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\* ?/, "").trimEnd());
}

function fencedBlocks(lines: readonly string[]): { readonly examples: DocExample[]; readonly unfenced: boolean } {
    const examples: DocExample[] = [];
    let open: { readonly info: string; readonly language: string; readonly code: string[] } | null = null;

    for (const line of lines) {
        const fence = FENCE.exec(line.trim());

        if (fence === null) {
            open?.code.push(line);
            continue;
        }

        if (open === null) {
            open = { language: fence[1] ?? "", info: fence[2] ?? "", code: [] };
            continue;
        }

        const runnable = RUNNABLE_LANGUAGES.includes(open.language) && !open.info.includes("no-run");
        examples.push({ code: open.code.join("\n").trim(), run: runnable });
        open = null;
    }

    return { examples, unfenced: examples.length === 0 };
}

/**
 * Splits a TSDoc comment into its summary (the text before the first tag) and its `@example` blocks.
 *
 * @param comment - The full comment, from its opening `/**` up to its closing delimiter.
 * @returns The summary, every fenced example, and problems such as an `@example` without a fenced block.
 *
 * @example
 * ```ts
 * const fence = "`".repeat(3);
 * const doc = parseDocComment(`/**\n * Adds two numbers.\n *\n * @example\n * ${fence}ts\n * add(1, 2);\n * ${fence}\n *\/`);
 *
 * expect(doc.summary).toBe("Adds two numbers.");
 * expect(doc.examples).toEqual([{ code: "add(1, 2);", run: true }]);
 * ```
 */
export function parseDocComment(comment: string): ParsedDoc {
    const lines = commentLines(comment);
    const sections: { tag: string; lines: string[] }[] = [{ tag: "summary", lines: [] }];
    let inFence = false;

    for (const line of lines) {
        const tag = inFence ? null : TAG.exec(line);

        if (FENCE.test(line.trim())) {
            inFence = !inFence;
        }

        if (tag !== null) {
            sections.push({ tag: tag[1] ?? "", lines: [line.replace(TAG, "")] });
            continue;
        }

        sections.at(-1)?.lines.push(line);
    }

    const exampleSections = sections
        .filter((section) => section.tag === "example")
        .map((section) => fencedBlocks(section.lines));

    return {
        summary: (sections[0]?.lines ?? []).join("\n").trim(),
        examples: exampleSections.flatMap((section) => section.examples),
        problems: exampleSections.some((section) => section.unfenced)
            ? ["@example needs a ```ts fenced code block"]
            : [],
    };
}

/**
 * Finds every top-level `export` declaration in a TypeScript source, with the TSDoc directly above it.
 *
 * @remarks
 * A deliberately small, regex-based scanner: it recognises `export function|const|let|class|type|interface|enum`
 * at the start of a line. Re-exports (`export { … }`) and default exports are not checked.
 *
 * @param source - The contents of a `.ts` file.
 * @returns One entry per export, in source order. Exports without TSDoc have an empty summary.
 *
 * @example
 * ```ts
 * const [add, total] = findDocumentedExports("/** Adds. *\/\nexport function add() {}\nexport const total = 3;\n");
 *
 * expect(add).toMatchObject({ name: "add", kind: "function", line: 2, summary: "Adds." });
 * expect(total).toMatchObject({ name: "total", kind: "value", line: 3, summary: "" });
 * ```
 */
export function findDocumentedExports(source: string): DocumentedExport[] {
    return [...source.matchAll(EXPORT)].map((match) => {
        const [, comment, keyword = "", name = "", rest = ""] = match;
        const exportIndex = match.index + (comment === undefined ? 0 : comment.length + 1);
        const doc = comment === undefined ? { summary: "", examples: [], problems: [] } : parseDocComment(comment);

        return {
            name,
            kind: kindOf(keyword, rest),
            line: source.slice(0, exportIndex).split("\n").length,
            ...doc,
        };
    });
}

/**
 * Lists what the documentation convention asks of an export that is missing.
 *
 * @param entry - An export found by {@link findDocumentedExports}.
 * @returns Human-readable problems; empty when the export is documented well enough.
 *
 * @example
 * ```ts
 * const undocumented = { name: "add", kind: "function", line: 1, summary: "", examples: [], problems: [] } as const;
 *
 * expect(documentationProblems(undocumented)).toEqual(["add: missing TSDoc summary", "add: missing @example"]);
 * ```
 */
export function documentationProblems(entry: DocumentedExport): string[] {
    const needsExample = entry.kind === "function" || entry.kind === "class";

    return [
        ...(entry.summary.length === 0 ? [`${entry.name}: missing TSDoc summary`] : []),
        ...(needsExample && entry.examples.length === 0 && entry.problems.length === 0
            ? [`${entry.name}: missing @example`]
            : []),
        ...entry.problems.map((problem) => `${entry.name}: ${problem}`),
    ];
}

const indent = (code: string, spaces: string): string =>
    code
        .split("\n")
        .map((line) => (line.length === 0 ? line : `${spaces}${line}`))
        .join("\n");

/**
 * Renders a `bun:test` file that runs every runnable example of one module.
 *
 * @remarks
 * Each example runs in its own async test, in a block of its own, with all of the module's runtime exports and
 * `expect` in scope. Bun strips types without checking them, so type names in examples need no import.
 *
 * @param exports - The module's exports, as found by {@link findDocumentedExports}.
 * @param options.modulePath - Absolute path of the module the examples belong to.
 * @param options.label - How the module is named in test titles, e.g. its path relative to the project.
 * @returns The test file's source, or `null` when the module has no runnable examples.
 *
 * @example
 * ```ts
 * const add = { name: "add", kind: "function", line: 1, summary: "Adds.", problems: [], examples: [{ code: "add(1, 2);", run: true }] } as const;
 * const file = renderDoctestFile([add], { modulePath: "/src/math.ts", label: "src/math.ts" });
 *
 * expect(file).toContain('import * as __module from "/src/math.ts";');
 * expect(file).toContain('test("src/math.ts › add › example 1", async () => {');
 * ```
 */
export function renderDoctestFile(
    exports: readonly DocumentedExport[],
    { modulePath, label }: { readonly modulePath: string; readonly label: string },
): string | null {
    const values = exports.filter((entry) => entry.kind !== "type").map((entry) => entry.name);
    const tests = exports.flatMap((entry) =>
        entry.examples
            .filter((example) => example.run)
            .map((example, index) =>
                [
                    `test(${JSON.stringify(`${label} › ${entry.name} › example ${index + 1}`)}, async () => {`,
                    `    const { ${values.join(", ")} } = __module;`,
                    "    {",
                    indent(example.code, "        "),
                    "    }",
                    "});",
                ].join("\n"),
            ),
    );

    if (tests.length === 0) {
        return null;
    }

    return [
        'import { expect, test } from "bun:test";',
        `import * as __module from ${JSON.stringify(modulePath)};`,
        "",
        tests.join("\n\n"),
        "",
    ].join("\n");
}

const isSourceFile = (fileName: string): boolean =>
    fileName.endsWith(".ts") && !fileName.endsWith(".test.ts") && !fileName.endsWith(".d.ts");

async function sourceFiles(target: string, { signal }: { readonly signal: AbortSignal }): Promise<string[]> {
    // Bun.file takes no signal: check before starting instead.
    signal.throwIfAborted();

    const isSingleSourceFile = isSourceFile(target) && (await Bun.file(target).exists());

    if (isSingleSourceFile) {
        return [target];
    }

    const entries = await readDirRecursive(target, { maxEntries: SOURCE_ENTRIES_MAX, signal });

    return entries
        .map((entry) => entry.name)
        .filter((name) => isSourceFile(name) && !name.split(path.sep).includes("node_modules"))
        .map((name) => path.join(target, name))
        .toSorted();
}

async function main(): Promise<void> {
    const targets = Bun.argv.slice(2);

    if (targets.length === 0) {
        console.error("Usage: doctest.ts <file|dir>...");
        process.exitCode = 1;
        return;
    }

    const signal = interruptSignal();
    const files = (await Promise.all(targets.map((target) => sourceFiles(path.resolve(target), { signal })))).flat();
    const modules = await Promise.all(
        files.map(async (file) => ({
            file,
            label: path.relative(process.cwd(), file),
            exports: findDocumentedExports(await readText(file, { maxBytes: TEXT_BYTES_MAX, signal })),
        })),
    );
    const problems = modules.flatMap(({ label, exports }) =>
        exports.flatMap((entry) => documentationProblems(entry).map((problem) => `${label}:${entry.line} ${problem}`)),
    );

    if (problems.length > 0) {
        console.error(problems.map((problem) => `✗ ${problem}`).join("\n"));
        process.exitCode = 1;
    }

    const doctests = modules.flatMap(({ file, label, exports }) => {
        const content = renderDoctestFile(exports, { modulePath: file, label });

        return content === null ? [] : [content];
    });
    // Inside the project, so imports of its packages resolve from the generated tests too.
    const dir = await mkdtemp(path.join(process.cwd(), ".doctest-"));

    try {
        await Promise.all(
            doctests.map((content, index) => Bun.write(path.join(dir, `${index}.doctest.test.ts`), content)),
        );

        const run = Bun.spawn(["bun", "test", dir], { stdout: "inherit", stderr: "inherit", signal });

        if ((await run.exited) !== 0) {
            process.exitCode = 1;
        }
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

if (import.meta.main) {
    await main();
}

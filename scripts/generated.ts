// Generated files (ADR 0013, 0015, 0020): written by `bun run generate`, checked by `bun run validate`.

import path from "node:path";
import { readDir, readText, whenMissing } from "../lib/files.ts";

const GENERATED_FILES_MAX = 100; // one generated folder: 9 task agents, 5 bundles
const GENERATED_BYTES_MAX = 5 * 1024 * 1024; // the largest is a bundle of about 120 KB

/** Generated files by file name, with their content. */
export type GeneratedFiles = ReadonlyMap<string, string>;

/**
 * Reads the generated files in one folder.
 *
 * @param dir - The folder to read.
 * @param options.extension - Only files ending in this extension are read, e.g. `".md"`.
 * @param options.signal - Cancels the reads.
 * @returns File name → content; empty when the folder doesn't exist yet.
 * @throws Error when the folder has more than 100 entries, or a file is larger than 5 MiB.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/generated-`);
 * const signal = AbortSignal.timeout(5_000);
 * await Bun.write(`${dir}/review.md`, "content");
 * await Bun.write(`${dir}/notes.txt`, "ignored");
 *
 * expect(await readGeneratedFiles(dir, { extension: ".md", signal })).toEqual(new Map([["review.md", "content"]]));
 * expect(await readGeneratedFiles(`${dir}/missing`, { extension: ".md", signal })).toEqual(new Map());
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readGeneratedFiles(
    dir: string,
    { extension, signal }: { readonly extension: string; readonly signal: AbortSignal },
): Promise<GeneratedFiles> {
    const entries = await readDir(dir, { maxEntries: GENERATED_FILES_MAX, signal }).catch(whenMissing([]));
    const fileNames = entries
        .map((entry) => entry.name)
        .filter((fileName) => fileName.endsWith(extension))
        .toSorted();
    const contents = await Promise.all(
        fileNames.map((fileName) =>
            readText(path.join(dir, fileName), { maxBytes: GENERATED_BYTES_MAX, signal, symbolicLinks: "follow" }),
        ),
    );

    return new Map(fileNames.map((fileName, index) => [fileName, contents[index] ?? ""]));
}

/**
 * Compares generated files on disk with what their sources produce now.
 *
 * @param expected - The files the sources produce.
 * @param actual - The files on disk.
 * @param options.label - How the folder is named in messages, e.g. `agents/tasks`.
 * @returns One problem per missing, stale (edited or outdated) or orphaned file; empty when they match.
 *
 * @example
 * ```ts
 * const expected = new Map([["review.md", "current"]]);
 *
 * expect(generatedFileErrors(expected, expected, { label: "agents/tasks" })).toEqual([]);
 * expect(generatedFileErrors(expected, new Map([["old.md", "orphan"]]), { label: "agents/tasks" })).toEqual([
 *     "agents/tasks/review.md is missing or out of date: run `bun run generate`",
 *     "agents/tasks/old.md is no longer generated: run `bun run generate`",
 * ]);
 * ```
 */
export function generatedFileErrors(
    expected: GeneratedFiles,
    actual: GeneratedFiles,
    { label }: { readonly label: string },
): string[] {
    const missingOrStale = [...expected]
        .filter(([fileName, content]) => actual.get(fileName) !== content)
        .map(([fileName]) => `${path.join(label, fileName)} is missing or out of date: run \`bun run generate\``);
    const orphaned = [...actual.keys()]
        .filter((fileName) => !expected.has(fileName))
        .map((fileName) => `${path.join(label, fileName)} is no longer generated: run \`bun run generate\``);

    return [...missingOrStale, ...orphaned];
}

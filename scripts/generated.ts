// Generated files (ADR 0013, 0015, 0020): written by `bun run generate`, checked by `bun run validate`.

import { readdir } from "node:fs/promises";
import path from "node:path";
import { isFileNotFound } from "../lib/errors.ts";

/** Generated files by file name, with their content. */
export type GeneratedFiles = ReadonlyMap<string, string>;

async function listDir(dir: string): Promise<string[]> {
    try {
        return await readdir(dir);
    } catch (error: unknown) {
        if (isFileNotFound(error)) {
            return [];
        }
        throw error;
    }
}

/**
 * Reads the generated files in one folder.
 *
 * @param dir - The folder to read.
 * @param options.extension - Only files ending in this extension are read, e.g. `".md"`.
 * @returns File name → content; empty when the folder doesn't exist yet.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/generated-`);
 * await Bun.write(`${dir}/review.md`, "content");
 * await Bun.write(`${dir}/notes.txt`, "ignored");
 *
 * expect(await readGeneratedFiles(dir, { extension: ".md" })).toEqual(new Map([["review.md", "content"]]));
 * expect(await readGeneratedFiles(`${dir}/missing`, { extension: ".md" })).toEqual(new Map());
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readGeneratedFiles(
    dir: string,
    { extension }: { readonly extension: string },
): Promise<GeneratedFiles> {
    const fileNames = (await listDir(dir)).filter((fileName) => fileName.endsWith(extension)).toSorted();
    const contents = await Promise.all(fileNames.map((fileName) => Bun.file(path.join(dir, fileName)).text()));

    return new Map(fileNames.map((fileName, index) => [fileName, contents[index] ?? ""]));
}

/**
 * Compares generated files on disk with what their sources produce now.
 *
 * @param label - How the folder is named in messages, e.g. `agents/tasks`.
 * @param expected - The files the sources produce.
 * @param actual - The files on disk.
 * @returns One problem per missing, stale (edited or outdated) or orphaned file; empty when they match.
 *
 * @example
 * ```ts
 * const expected = new Map([["review.md", "current"]]);
 *
 * expect(generatedFileErrors("agents/tasks", expected, expected)).toEqual([]);
 * expect(generatedFileErrors("agents/tasks", expected, new Map([["old.md", "orphan"]]))).toEqual([
 *     "agents/tasks/review.md is missing or out of date: run `bun run generate`",
 *     "agents/tasks/old.md is no longer generated: run `bun run generate`",
 * ]);
 * ```
 */
export function generatedFileErrors(label: string, expected: GeneratedFiles, actual: GeneratedFiles): string[] {
    const missingOrStale = [...expected]
        .filter(([fileName, content]) => actual.get(fileName) !== content)
        .map(([fileName]) => `${label}/${fileName} is missing or out of date: run \`bun run generate\``);
    const orphaned = [...actual.keys()]
        .filter((fileName) => !expected.has(fileName))
        .map((fileName) => `${label}/${fileName} is no longer generated: run \`bun run generate\``);

    return [...missingOrStale, ...orphaned];
}

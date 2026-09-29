import { readdir, readFile } from "node:fs/promises";
import { isFileNotFound } from "./errors.ts";

/**
 * Reads a text file (UTF-8), cancellably.
 *
 * @remarks
 * `Bun.file().text()` takes no signal; `node:fs/promises` does (ADR 0012).
 *
 * @param path - The file to read.
 * @param options.signal - Cancels the read.
 * @returns The file's contents.
 * @throws Error with code `ENOENT` when the file doesn't exist (see `isFileNotFound`).
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/files-`);
 * await Bun.write(`${dir}/note.txt`, "hello");
 *
 * expect(await readText(`${dir}/note.txt`, { signal: AbortSignal.timeout(5_000) })).toBe("hello");
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export function readText(path: string, { signal }: { readonly signal: AbortSignal }): Promise<string> {
    return readFile(path, { encoding: "utf8", signal });
}

/**
 * Reads and parses a JSON file, cancellably. The result is untrusted: parse it with a schema (ADR 0020).
 *
 * @param path - The file to read.
 * @param options.signal - Cancels the read.
 * @returns The parsed JSON, typed as `unknown`.
 * @throws SyntaxError when the file is not valid JSON.
 * @throws Error with code `ENOENT` when the file doesn't exist.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/files-`);
 * await Bun.write(`${dir}/config.json`, '{ "port": 8080 }');
 *
 * expect(await readJson(`${dir}/config.json`, { signal: AbortSignal.timeout(5_000) })).toEqual({ port: 8080 });
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readJson(path: string, { signal }: { readonly signal: AbortSignal }): Promise<unknown> {
    const text = await readText(path, { signal });

    return JSON.parse(text);
}

/**
 * Reads a text file that may not exist yet, cancellably.
 *
 * @param path - The file to read.
 * @param options.signal - Cancels the read.
 * @returns The file's contents, or `null` when the file doesn't exist.
 * @throws DOMException named `AbortError` when `signal` aborts; any error other than "not found" is rethrown.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/files-`);
 * const signal = AbortSignal.timeout(5_000);
 *
 * expect(await readTextIfExists(`${dir}/CATALOG.md`, { signal })).toBeNull();
 *
 * await Bun.write(`${dir}/CATALOG.md`, "# Catalog");
 * expect(await readTextIfExists(`${dir}/CATALOG.md`, { signal })).toBe("# Catalog");
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readTextIfExists(
    path: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<string | null> {
    try {
        return await readText(path, { signal });
    } catch (error: unknown) {
        if (isFileNotFound(error)) {
            return null;
        }
        throw error;
    }
}

/**
 * Lists a directory's entries, cancellably; empty when the directory doesn't exist yet.
 *
 * @remarks
 * `node:fs/promises`' `readdir` takes no signal (ADR 0012): checked before starting instead.
 *
 * @param dir - The directory to list.
 * @param options.signal - Cancels the read.
 * @returns The entry names, in `readdir`'s order; empty when the directory is missing.
 * @throws DOMException named `AbortError` when `signal` aborts; any error other than "not found" is rethrown.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/files-`);
 * const signal = AbortSignal.timeout(5_000);
 *
 * expect(await readDirIfExists(`${dir}/missing`, { signal })).toEqual([]);
 *
 * await Bun.write(`${dir}/a.txt`, "a");
 * expect(await readDirIfExists(dir, { signal })).toEqual(["a.txt"]);
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readDirIfExists(dir: string, { signal }: { readonly signal: AbortSignal }): Promise<string[]> {
    signal.throwIfAborted();

    try {
        return await readdir(dir);
    } catch (error: unknown) {
        if (isFileNotFound(error)) {
            return [];
        }
        throw error;
    }
}

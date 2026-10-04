import { constants, type Stats } from "node:fs";
import { type FileHandle, lstat, open, opendir, stat } from "node:fs/promises";
import path from "node:path";
import { assert } from "./assert.ts";
import { isFileNotFound } from "./errors.ts";

/** Maximum size of a JSON file we read: our config and manifests, and `package.json`s. The largest is a few KB. */
export const JSON_BYTES_MAX = 1024 * 1024;

/** Maximum size of a text file we read: Markdown, licenses and source files. The largest is about 20 KB. */
export const TEXT_BYTES_MAX = 1024 * 1024;

type ReadOptions = {
    /** The largest file accepted, in bytes; at least 1. */
    readonly maxBytes: number;
    readonly signal: AbortSignal;
    /**
     * What to do when the path itself is a symbolic link: `"follow"` reads its target, `"refuse"` throws a
     * `SymbolicLinkError`. Required, because following is the risky choice for content a branch controls. Only the last
     * part of the path is checked; links among the folders above it are followed.
     */
    readonly symbolicLinks: "follow" | "refuse";
};

/**
 * The error `readText` and `readJson` throw for a path that is a symbolic link, when called with
 * `symbolicLinks: "refuse"`.
 *
 * @example
 * ```ts
 * const error = new SymbolicLinkError("docs/note.md");
 *
 * expect(error.message).toBe("docs/note.md is a symbolic link");
 * expect(error.name).toBe("SymbolicLinkError");
 * ```
 */
export class SymbolicLinkError extends Error {
    /**
     * @param filePath - The path that is a symbolic link.
     */
    constructor(filePath: string) {
        super(`${filePath} is a symbolic link`);
        this.name = "SymbolicLinkError";
    }
}

/**
 * The message that tells a person a file they must fix is a symbolic link, in one shape for every file.
 *
 * @param relativePath - The file's path as the person knows it, relative to the project.
 * @returns The message, e.g. for a `SymbolicLinkError` caught while reading the file.
 *
 * @example
 * ```ts
 * expect(symbolicLinkMessage(".claude/factory.json")).toBe(
 *     ".claude/factory.json is a symbolic link; use a regular file",
 * );
 * ```
 */
export function symbolicLinkMessage(relativePath: string): string {
    return `${relativePath} is a symbolic link; use a regular file`;
}

type ListOptions = {
    /** The most entries accepted; at least 1. */
    readonly maxEntries: number;
    readonly signal: AbortSignal;
};

/** An entry of a directory listing. */
export type DirEntry = {
    /** The entry's name; for a recursive listing, its path relative to the listed directory. */
    readonly name: string;
    readonly isDirectory: boolean;
};

/**
 * Reads a regular text file (UTF-8), cancellably, after checking that it isn't larger than `maxBytes`.
 *
 * @remarks
 * `Bun.file().text()` takes no signal; `node:fs/promises` does (ADR 0012). The size is checked before reading, so
 * an oversized file is never loaded (ADR 0032).
 *
 * Only regular files are read. A FIFO, device, socket or directory is refused at once, before it is opened: opening
 * a FIFO waits for a writer, which no signal can cancel, and a device such as `/dev/zero` reports size 0 but never
 * ends, so the size check would not hold. The file is opened non-blocking and checked again, in case the path was
 * replaced in between.
 *
 * The caller must choose what happens at a symbolic link, with `symbolicLinks`; there is no default. `"follow"` reads
 * the link's target, which must be a regular file: use it where links are legitimate, such as the plugin's own files
 * and packages in `node_modules`. A link may point outside the folder it is in, so content a branch or pull request
 * controls, such as committed files, is read with `"refuse"`, or from git, which doesn't follow links (as
 * `decision-records` does). Refusing is atomic: the file is opened with `O_NOFOLLOW`, so a path swapped for a link
 * after the first check is refused too. It only covers the last part of the path; a caller that must stay inside a
 * folder also compares the folder's real path with the expected one.
 *
 * @param filePath - The file to read.
 * @param options.maxBytes - The largest file accepted, in bytes; at least 1.
 * @param options.signal - Cancels the read.
 * @param options.symbolicLinks - Whether to `"follow"` or `"refuse"` a path that is a symbolic link; required.
 * @returns The file's contents.
 * @throws SymbolicLinkError when `symbolicLinks` is `"refuse"` and the path is a symbolic link, even a dangling one.
 * @throws Error when the file, or the target of a followed link, isn't a regular file, naming what it is.
 * @throws Error when the file is larger than `maxBytes`.
 * @throws Error with code `ENOENT` when the file, or the target of a followed link, doesn't exist (see `whenMissing`).
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm, symlink } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/files-`);
 * const signal = AbortSignal.timeout(5_000);
 * await Bun.write(`${dir}/note.txt`, "hello");
 * await symlink(`${dir}/note.txt`, `${dir}/link.txt`);
 *
 * expect(await readText(`${dir}/note.txt`, { maxBytes: 5, signal, symbolicLinks: "follow" })).toBe("hello");
 * await expect(readText(`${dir}/note.txt`, { maxBytes: 4, signal, symbolicLinks: "follow" })).rejects.toThrow("over the limit of 4 bytes");
 * await expect(readText(dir, { maxBytes: 5, signal, symbolicLinks: "follow" })).rejects.toThrow("is a directory, not a regular file");
 *
 * expect(await readText(`${dir}/link.txt`, { maxBytes: 5, signal, symbolicLinks: "follow" })).toBe("hello");
 * await expect(readText(`${dir}/link.txt`, { maxBytes: 5, signal, symbolicLinks: "refuse" })).rejects.toThrow(
 *     `${dir}/link.txt is a symbolic link`,
 * );
 * expect(await readText(`${dir}/note.txt`, { maxBytes: 5, signal, symbolicLinks: "refuse" })).toBe("hello");
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readText(filePath: string, { maxBytes, signal, symbolicLinks }: ReadOptions): Promise<string> {
    assert(Number.isInteger(maxBytes), `maxBytes must be an integer, got ${maxBytes}`);
    assert(maxBytes >= 1, `maxBytes must be at least 1, got ${maxBytes}`);
    // open and stat take no signal: check before starting instead.
    signal.throwIfAborted();

    const isRefusingLinks = symbolicLinks === "refuse";
    // Before opening: opening a FIFO waits for a writer, and nothing can cancel that wait.
    const pathStats = isRefusingLinks ? await lstat(filePath) : await stat(filePath);

    if (pathStats.isSymbolicLink()) {
        throw new SymbolicLinkError(filePath);
    }

    checkRegularFile(filePath, pathStats);

    const handle = await openForReading(filePath, { isRefusingLinks });

    try {
        const stats = await handle.stat();
        checkRegularFile(filePath, stats);

        if (stats.size > maxBytes) {
            throw new Error(`${filePath} is ${stats.size} bytes, over the limit of ${maxBytes} bytes`);
        }

        return await handle.readFile({ encoding: "utf8", signal });
    } finally {
        await handle.close();
    }
}

/**
 * Opens a file for reading. Non-blocking, so a path swapped for a FIFO since the first check still opens at once; the
 * check after opening refuses it. It changes nothing for a regular file. (Windows has no O_NONBLOCK, and no FIFOs at
 * a file path.) With `O_NOFOLLOW`, opening a symbolic link fails with `ELOOP`, so a link swapped in is refused too.
 */
async function openForReading(
    filePath: string,
    { isRefusingLinks }: { readonly isRefusingLinks: boolean },
): Promise<FileHandle> {
    const flags = constants.O_RDONLY | constants.O_NONBLOCK | (isRefusingLinks ? constants.O_NOFOLLOW : 0);

    try {
        return await open(filePath, flags);
    } catch (error: unknown) {
        const isLink = isRefusingLinks && hasErrorCode(error, "ELOOP");

        if (isLink) {
            throw new SymbolicLinkError(filePath);
        }
        throw error;
    }
}

const hasErrorCode = (error: unknown, code: string): boolean =>
    error instanceof Error && "code" in error && error.code === code;

/** Refuses anything but a regular file: its size is the only one the size check can trust. */
function checkRegularFile(filePath: string, stats: Stats): void {
    if (stats.isFile()) {
        return;
    }

    throw new Error(`${filePath} is ${describeFileType(stats)}, not a regular file`);
}

function describeFileType(stats: Stats): string {
    if (stats.isDirectory()) {
        return "a directory";
    }

    if (stats.isFIFO()) {
        return "a FIFO";
    }

    if (stats.isCharacterDevice()) {
        return "a character device";
    }

    if (stats.isBlockDevice()) {
        return "a block device";
    }

    if (stats.isSocket()) {
        return "a socket";
    }

    return "a special file";
}

/**
 * Reads and parses a JSON file, cancellably and with a size limit. The result is untrusted: parse it with a schema
 * (ADR 0020).
 *
 * @param filePath - The file to read.
 * @param options.maxBytes - The largest file accepted, in bytes; at least 1.
 * @param options.signal - Cancels the read.
 * @param options.symbolicLinks - Whether to `"follow"` or `"refuse"` a path that is a symbolic link; required, see
 *   `readText`.
 * @returns The parsed JSON, typed as `unknown`.
 * @throws SyntaxError when the file is not valid JSON.
 * @throws SymbolicLinkError when `symbolicLinks` is `"refuse"` and the path is a symbolic link.
 * @throws Error when the file, or the target of a followed link, isn't a regular file, naming what it is.
 * @throws Error when the file is larger than `maxBytes`.
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
 * expect(
 *     await readJson(`${dir}/config.json`, { maxBytes: JSON_BYTES_MAX, signal: AbortSignal.timeout(5_000), symbolicLinks: "follow" }),
 * ).toEqual({ port: 8080 });
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readJson(filePath: string, options: ReadOptions): Promise<unknown> {
    const text = await readText(filePath, options);

    return JSON.parse(text);
}

async function listDir(
    dir: string,
    { maxEntries, recursive, signal }: ListOptions & { readonly recursive: boolean },
): Promise<DirEntry[]> {
    assert(Number.isInteger(maxEntries), `maxEntries must be an integer, got ${maxEntries}`);
    assert(maxEntries >= 1, `maxEntries must be at least 1, got ${maxEntries}`);
    // opendir takes no signal: check before starting and between entries instead.
    signal.throwIfAborted();

    const entries: DirEntry[] = [];

    // Stateful on purpose: it stops as soon as the limit is crossed, without listing the rest (ADR 0032).
    // Leaving the loop, also by throwing, closes the directory.
    for await (const entry of await opendir(dir, { recursive })) {
        signal.throwIfAborted();

        if (entries.length === maxEntries) {
            throw new Error(`${dir} has more than ${maxEntries} entries`);
        }

        const name = path.relative(dir, path.join(entry.parentPath, entry.name));
        entries.push({ name, isDirectory: entry.isDirectory() });
    }

    return entries;
}

/**
 * Lists a directory's entries, cancellably, failing as soon as there are more than `maxEntries`.
 *
 * @param dir - The directory to list.
 * @param options.maxEntries - The most entries accepted; at least 1.
 * @param options.signal - Cancels the listing.
 * @returns The entries, in the file system's order.
 * @throws Error when the directory has more than `maxEntries` entries.
 * @throws Error with code `ENOENT` when the directory doesn't exist (see `whenMissing`).
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/files-`);
 * const signal = AbortSignal.timeout(5_000);
 * await Bun.write(`${dir}/a.txt`, "a");
 *
 * expect(await readDir(dir, { maxEntries: 1, signal })).toEqual([{ name: "a.txt", isDirectory: false }]);
 * expect(await readDir(`${dir}/missing`, { maxEntries: 1, signal }).catch(whenMissing([]))).toEqual([]);
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export function readDir(dir: string, options: ListOptions): Promise<DirEntry[]> {
    return listDir(dir, { ...options, recursive: false });
}

/**
 * Lists a directory and everything below it, cancellably, failing as soon as there are more than `maxEntries`.
 *
 * @param dir - The directory to list.
 * @param options.maxEntries - The most entries accepted, counted over all levels; at least 1.
 * @param options.signal - Cancels the listing.
 * @returns Every entry below `dir`, named by its path relative to `dir`, in the file system's order.
 * @throws Error when there are more than `maxEntries` entries.
 * @throws Error with code `ENOENT` when the directory doesn't exist (see `whenMissing`).
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/files-`);
 * await Bun.write(`${dir}/src/a.ts`, "");
 *
 * const entries = await readDirRecursive(dir, { maxEntries: 2, signal: AbortSignal.timeout(5_000) });
 *
 * expect(entries.map((entry) => entry.name).toSorted()).toEqual(["src", "src/a.ts"]);
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export function readDirRecursive(dir: string, options: ListOptions): Promise<DirEntry[]> {
    return listDir(dir, { ...options, recursive: true });
}

/**
 * Makes a `.catch` handler that turns "file or directory not found" into `fallback`, and rethrows every other
 * error.
 *
 * @remarks
 * For reads where a missing file is an expected state, e.g. a folder that only exists once something was written
 * to it. Permission errors, oversized files and aborts still fail.
 *
 * @param fallback - The value to use when the file or directory doesn't exist.
 * @returns A rejection handler for `.catch`.
 *
 * @example
 * ```ts
 * const signal = AbortSignal.timeout(5_000);
 *
 * expect(await readText("/does/not/exist", { maxBytes: 10, signal, symbolicLinks: "follow" }).catch(whenMissing(null))).toBeNull();
 * expect(() => whenMissing(null)(new Error("boom"))).toThrow("boom");
 * ```
 */
export function whenMissing<T>(fallback: T): (error: unknown) => T {
    return (error: unknown): T => {
        if (isFileNotFound(error)) {
            return fallback;
        }
        throw error;
    };
}

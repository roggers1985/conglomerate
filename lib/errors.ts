/**
 * Checks whether an error means "this file or directory does not exist".
 *
 * @remarks
 * For code where a missing file is an expected state (e.g. a folder that only exists once something was written to
 * it). Every other error is unexpected and should be rethrown.
 *
 * @param error - A caught error, of unknown type.
 * @returns `true` for Node/Bun errors with code `ENOENT`.
 *
 * @example
 * ```ts
 * const { readdir } = await import("node:fs/promises");
 * const error = await readdir("/does/not/exist").catch((caught: unknown) => caught);
 *
 * expect(isFileNotFound(error)).toBe(true);
 * expect(isFileNotFound(new Error("boom"))).toBe(false);
 * ```
 */
export function isFileNotFound(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
}

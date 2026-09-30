/**
 * The project folder a plugin script works on: an explicit argument, else the folder Claude Code runs in
 * (`CLAUDE_PROJECT_DIR`), else the current directory.
 *
 * @param options.argument - A folder passed on the command line; `undefined` when none was passed.
 * @param options.envProjectDir - The value of `CLAUDE_PROJECT_DIR`; `undefined` when it isn't set.
 * @param options.cwd - The current directory, used when neither is given.
 * @returns The first of them that isn't empty.
 *
 * @example
 * ```ts
 * expect(resolveProjectDir({ argument: undefined, envProjectDir: "/work/app", cwd: "/tmp" })).toBe("/work/app");
 * expect(resolveProjectDir({ argument: "", envProjectDir: undefined, cwd: "/tmp" })).toBe("/tmp");
 * ```
 */
export function resolveProjectDir({
    argument,
    envProjectDir,
    cwd,
}: {
    readonly argument: string | undefined;
    readonly envProjectDir: string | undefined;
    readonly cwd: string;
}): string {
    return [argument, envProjectDir].find((dir) => dir !== undefined && dir.length > 0) ?? cwd;
}

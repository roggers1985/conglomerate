// Decision records (ADR 0001) added on a change's branch, for its pull request description (ADR 0056).

import path from "node:path";
import { mapConcurrent } from "../../../lib/concurrency.ts";
import { readText, TEXT_BYTES_MAX } from "../../../lib/files.ts";

/**
 * The most decision records one branch may add; more is refused.
 *
 * @remarks
 * A change with this many decisions should be split (the spec's limits). The largest change so far added two.
 */
export const DECISION_RECORDS_MAX = 100;

const DECISIONS_DIR = "docs/decisions";
const GIT_TIMEOUT_MS = 10_000; // one rev-parse or diff over a few paths; both take well under a second
// git's output is at most a list of paths under docs/decisions; 1 MiB holds thousands, far past DECISION_RECORDS_MAX.
const GIT_OUTPUT_BYTES_MAX = 1024 * 1024;
const READS_IN_FLIGHT_MAX = 8; // small files; a few at once is plenty
// The variables that point git at a repository other than the one around its working directory, from
// `git rev-parse --local-env-vars`. git sets GIT_DIR for hooks in a worktree, for example; projectDir decides instead.
const GIT_LOCAL_ENV_VARS: ReadonlySet<string> = new Set([
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CONFIG",
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_COUNT",
    "GIT_OBJECT_DIRECTORY",
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_IMPLICIT_WORK_TREE",
    "GIT_GRAFT_FILE",
    "GIT_INDEX_FILE",
    "GIT_NO_REPLACE_OBJECTS",
    "GIT_REPLACE_REF_BASE",
    "GIT_PREFIX",
    "GIT_SHALLOW_FILE",
    "GIT_COMMON_DIR",
]);
// `git rev-parse --verify --quiet` exits with 1, and prints nothing, when the revision doesn't exist.
const REV_PARSE_NOT_FOUND_EXIT_CODE = 1;

/** A decision record that a branch added. */
export type DecisionRecord = {
    /** The record's path relative to the project folder, with `/` separators, e.g. `docs/decisions/0057-x.md`. */
    readonly file: string;
    /** The text of its first `# ` heading, e.g. `57. Secure by default`. */
    readonly title: string;
    /** Whether its status (the first line after `## Status`) starts with "Proposed". */
    readonly isProposed: boolean;
};

/**
 * The outcome of {@link addedDecisionRecords}: the records the branch added (sorted by path, possibly none), or a
 * base branch that doesn't exist.
 */
export type AddedDecisionRecordsResult =
    | { readonly kind: "found"; readonly records: readonly DecisionRecord[] }
    | { readonly kind: "unknown-base"; readonly base: string };

type GitRun = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };

/**
 * Finds the decision records (`docs/decisions/*.md`) added on the current branch compared with `base`, with each
 * one's title and whether it is Proposed.
 *
 * @remarks
 * Compares from the point where the branch left `base` (`git diff <base>...HEAD`), so records added on `base` since
 * then don't count. A record changed or deleted on the branch isn't added; one moved there from elsewhere is (renames
 * are off, so the result doesn't depend on git's configuration). git runs without a shell, with `base` as a single
 * argument, in `projectDir`: variables such as `GIT_DIR` that would point it at another repository are left out of
 * its environment. Each git run gets the caller's signal plus a 10-second timeout (ADR 0012), and its output is
 * bounded.
 *
 * @param projectDir - The project folder, at or inside a git repository; `docs/decisions` is relative to it.
 * @param options.base - The branch (or any commit) the change will merge into, e.g. `main`. Not blank, and not
 *   starting with `-`.
 * @param options.signal - Cancels git and the reads.
 * @returns `found` with the added records sorted by path (empty when there are none), or `unknown-base` when `base`
 *   names no commit.
 * @throws Error when `base` is blank or starts with `-`, before git runs.
 * @throws Error when the branch adds more than {@link DECISION_RECORDS_MAX} records.
 * @throws Error when a record has no `# ` title or no status line after `## Status`.
 * @throws Error with git's message when git fails, e.g. outside a repository or when `base` shares no history.
 * @throws DOMException named `AbortError` (or `TimeoutError`) when cancelled; git is stopped and nothing partial is
 *   returned.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/decision-records-`);
 * // The example's own repository, without your git configuration or a surrounding hook's GIT_DIR.
 * const env = { HOME: dir, PATH: process.env["PATH"] ?? "" };
 * const git = (...args: string[]) =>
 *     Bun.spawnSync(["git", "-c", "user.name=Ada", "-c", "user.email=ada@example.com", ...args], { cwd: dir, env });
 * git("init", "--quiet", "--initial-branch=main");
 * git("commit", "--quiet", "--allow-empty", "--message=Start");
 * git("switch", "--quiet", "--create", "change");
 * await Bun.write(`${dir}/docs/decisions/0001-use-bun.md`, "# 1. Use Bun\n\n## Status\n\nProposed\n");
 * git("add", "--all");
 * git("commit", "--quiet", "--message=Decide");
 * const signal = AbortSignal.timeout(10_000);
 *
 * expect(await addedDecisionRecords(dir, { base: "main", signal })).toEqual({
 *     kind: "found",
 *     records: [{ file: "docs/decisions/0001-use-bun.md", title: "1. Use Bun", isProposed: true }],
 * });
 * expect(await addedDecisionRecords(dir, { base: "release", signal })).toEqual({
 *     kind: "unknown-base",
 *     base: "release",
 * });
 * await expect(addedDecisionRecords(dir, { base: "--help", signal })).rejects.toThrow('starts with "-"');
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function addedDecisionRecords(
    projectDir: string,
    { base, signal }: { readonly base: string; readonly signal: AbortSignal },
): Promise<AddedDecisionRecordsResult> {
    checkBase(base);

    const isKnownBase = await baseExists(projectDir, { base, signal });

    if (!isKnownBase) {
        return { kind: "unknown-base", base };
    }

    const files = await addedRecordFiles(projectDir, { base, signal });

    if (files.length > DECISION_RECORDS_MAX) {
        throw new Error(
            `The branch adds ${files.length} decision records, more than the limit of ${DECISION_RECORDS_MAX}: split the change`,
        );
    }

    const records = await mapConcurrent(files, (file) => readRecord(projectDir, file, { signal }), {
        concurrency: READS_IN_FLIGHT_MAX,
        signal,
    });

    return { kind: "found", records };
}

/** Refuses a base that git would misread: blank, or an option. */
function checkBase(base: string): void {
    if (base.trim() === "") {
        throw new Error("The base branch is empty");
    }

    if (base.startsWith("-")) {
        throw new Error(`The base branch "${base}" starts with "-", so git would read it as an option`);
    }
}

async function baseExists(projectDir: string, { base, signal }: { base: string; signal: AbortSignal }) {
    const args = ["rev-parse", "--verify", "--quiet", "--end-of-options", `${base}^{commit}`];
    const run = await runGit(args, { cwd: projectDir, signal });

    if (run.exitCode === REV_PARSE_NOT_FOUND_EXIT_CODE) {
        return false;
    }

    checkExitCode(args, run);

    return true;
}

/** The added `.md` files under docs/decisions, relative to projectDir, sorted. */
async function addedRecordFiles(projectDir: string, { base, signal }: { base: string; signal: AbortSignal }) {
    // -z: paths as they are, NUL-separated, instead of quoted when they aren't ASCII. --relative: relative to
    // projectDir, also when it is a folder inside the repository. --no-renames: independent of diff.renames.
    const args = [
        "diff",
        "--name-only",
        "-z",
        "--diff-filter=A",
        "--no-renames",
        "--relative",
        "--no-color",
        `${base}...HEAD`,
        "--",
        DECISIONS_DIR,
    ];
    const run = await runGit(args, { cwd: projectDir, signal });
    checkExitCode(args, run);

    return run.stdout
        .split("\0")
        .filter((file) => file.endsWith(".md"))
        .toSorted();
}

async function readRecord(projectDir: string, file: string, { signal }: { signal: AbortSignal }) {
    const text = await readText(path.join(projectDir, file), { maxBytes: TEXT_BYTES_MAX, signal });

    return parseRecord(file, text);
}

function parseRecord(file: string, text: string): DecisionRecord {
    const lines = text.split(/\r?\n/);
    const titleLine = lines.find((line) => line.startsWith("# "));

    if (titleLine === undefined) {
        throw new Error(`${file} has no title (a "# " heading)`);
    }

    const title = titleLine.slice("# ".length).trim();

    if (title === "") {
        throw new Error(`${file} has no title (a "# " heading)`);
    }

    const statusIndex = lines.findIndex((line) => line.trimEnd() === "## Status");
    const status = statusIndex === -1 ? undefined : lines.slice(statusIndex + 1).find((line) => line.trim() !== "");

    if (status === undefined) {
        throw new Error(`${file} has no status (a line after its ## Status heading)`);
    }

    if (status.startsWith("#")) {
        throw new Error(`${file} has no status (a line after its ## Status heading)`);
    }

    return { file, title, isProposed: status.trim().startsWith("Proposed") };
}

function checkExitCode(args: readonly string[], run: GitRun): void {
    if (run.exitCode !== 0) {
        throw new Error(`git ${args.join(" ")} failed (exit code ${run.exitCode}): ${run.stderr.trim()}`);
    }
}

/**
 * Runs git with an argument list (never a shell), and returns its exit code and output. Rejects with the signal's
 * reason when it aborts, also once git has finished, so no partial output is returned.
 */
async function runGit(args: readonly string[], { cwd, signal }: { cwd: string; signal: AbortSignal }) {
    const gitSignal = AbortSignal.any([signal, AbortSignal.timeout(GIT_TIMEOUT_MS)]);
    // Bun.spawn throws its own AbortError (not a DOMException, and without the timeout's name) for a signal that
    // already aborted; this throws the signal's reason instead.
    gitSignal.throwIfAborted();

    const child = Bun.spawn(["git", ...args], {
        cwd,
        env: gitEnvironment(),
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        // Kills git (SIGTERM) when it aborts; `exited` then still resolves, with git's exit code 143.
        signal: gitSignal,
    });

    try {
        const [stdout, stderr, exitCode] = await Promise.all([
            readBounded(child.stdout, `git ${args[0]}'s output`),
            readBounded(child.stderr, `git ${args[0]}'s error output`),
            child.exited,
        ]);
        gitSignal.throwIfAborted();

        return { exitCode, stdout, stderr } satisfies GitRun;
    } catch (error) {
        // Over the output limit, or aborted: don't leave git running.
        child.kill();
        throw error;
    }
}

function gitEnvironment(): Record<string, string | undefined> {
    return Object.fromEntries(Object.entries(process.env).filter(([name]) => !GIT_LOCAL_ENV_VARS.has(name)));
}

/** Reads a stream as UTF-8, failing as soon as it is over GIT_OUTPUT_BYTES_MAX instead of reading the rest. */
async function readBounded(stream: ReadableStream<Uint8Array>, what: string): Promise<string> {
    const chunks: Uint8Array[] = [];
    let sizeBytes = 0;

    // Bounded by the size check: leaving the loop by throwing cancels the stream.
    for await (const chunk of stream) {
        sizeBytes += chunk.byteLength;

        if (sizeBytes > GIT_OUTPUT_BYTES_MAX) {
            throw new Error(`${what} is over the limit of ${GIT_OUTPUT_BYTES_MAX} bytes`);
        }

        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString("utf8");
}

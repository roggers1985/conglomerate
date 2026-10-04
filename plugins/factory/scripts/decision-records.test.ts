import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assert } from "../../../lib/assert.ts";
import { TEXT_BYTES_MAX } from "../../../lib/files.ts";
import { addedDecisionRecords, DECISION_RECORDS_MAX } from "./decision-records.ts";

const AUTHOR = ["-c", "user.name=Test", "-c", "user.email=test@example.com"];

function git(dir: string, ...args: readonly string[]): string {
    // A minimal environment for the test repositories' own git calls: no user configuration (HOME is the temporary
    // folder, which has none), and no GIT_DIR from a surrounding hook (git sets it in a worktree's pre-push), which
    // would point them at this repository.
    // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase by convention.
    const env = { HOME: dir, PATH: process.env["PATH"] ?? "" };
    const result = Bun.spawnSync(["git", ...AUTHOR, ...args], { cwd: dir, env, stdout: "pipe", stderr: "pipe" });

    if (result.exitCode !== 0) {
        throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
    }

    return result.stdout.toString();
}

function buildRecord({ title = "1. Use Bun", status = "Accepted" }: { title?: string; status?: string } = {}): string {
    return `# ${title}\n\nDate: 2026-10-02\n\n## Status\n\n${status}\n\n## Context\n\nWhy.\n`;
}

async function writeFiles(dir: string, files: Readonly<Record<string, string>>): Promise<void> {
    await Promise.all(Object.entries(files).map(([file, content]) => Bun.write(path.join(dir, file), content)));
}

async function commit(dir: string, files: Readonly<Record<string, string>>, message: string): Promise<void> {
    await writeFiles(dir, files);
    git(dir, "add", "--all");
    git(dir, "commit", "--quiet", "--allow-empty", `--message=${message}`);
}

// A new signal per call, so no test inherits a timeout that started when the module was loaded.
const testSignal = (): AbortSignal => AbortSignal.timeout(30_000);
let dir = "";

// A repository with one record on main, and a branch `change` checked out from it.
async function createRepository(): Promise<void> {
    git(dir, "init", "--quiet", "--initial-branch=main");
    await commit(dir, { "docs/decisions/0001-use-bun.md": buildRecord() }, "Start");
    git(dir, "switch", "--quiet", "--create", "change");
}

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "decision-records-"));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe("addedDecisionRecords", () => {
    it("AC-5: lists the records added on the branch, sorted, with their titles, marking the Proposed ones", async () => {
        await createRepository();
        await commit(
            dir,
            {
                "docs/decisions/0003-use-zod.md": buildRecord({ title: "3. Use Zod", status: "Proposed" }),
                "docs/decisions/0002-use-biome.md": buildRecord({ title: "2. Use Biome" }),
            },
            "Decide",
        );

        const result = await addedDecisionRecords(dir, { base: "main", signal: testSignal() });

        expect(result).toEqual({
            kind: "found",
            records: [
                { file: "docs/decisions/0002-use-biome.md", title: "2. Use Biome", isProposed: false },
                { file: "docs/decisions/0003-use-zod.md", title: "3. Use Zod", isProposed: true },
            ],
        });
    });

    it("AC-5: finds nothing when the branch added no record", async () => {
        await createRepository();
        await commit(dir, { "README.md": "# Readme\n" }, "Unrelated");

        expect(await addedDecisionRecords(dir, { base: "main", signal: testSignal() })).toEqual({
            kind: "found",
            records: [],
        });
    });

    it("leaves out records that were changed or deleted rather than added", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0001-use-bun.md": buildRecord({ status: "Superseded" }) }, "Change");

        expect(await addedDecisionRecords(dir, { base: "main", signal: testSignal() })).toEqual({
            kind: "found",
            records: [],
        });
    });

    it("leaves out files that aren't Markdown, and Markdown outside docs/decisions", async () => {
        await createRepository();
        await commit(
            dir,
            { "docs/decisions/diagram.svg": "<svg/>", "docs/other/0002-not-a-record.md": buildRecord() },
            "Other files",
        );

        expect(await addedDecisionRecords(dir, { base: "main", signal: testSignal() })).toEqual({
            kind: "found",
            records: [],
        });
    });

    it("leaves out records added on the base branch after the change branched off", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0002-on-the-branch.md": buildRecord({ title: "2. On the branch" }) }, "A");
        git(dir, "switch", "--quiet", "main");
        await commit(dir, { "docs/decisions/0003-on-main.md": buildRecord({ title: "3. On main" }) }, "B");
        git(dir, "switch", "--quiet", "change");

        const result = await addedDecisionRecords(dir, { base: "main", signal: testSignal() });

        expect(result).toEqual({
            kind: "found",
            records: [{ file: "docs/decisions/0002-on-the-branch.md", title: "2. On the branch", isProposed: false }],
        });
    });

    it("lists a record whose file name isn't ASCII by its real name", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0002-café.md": buildRecord({ title: "2. Café" }) }, "Decide");

        const result = await addedDecisionRecords(dir, { base: "main", signal: testSignal() });

        expect(result).toEqual({
            kind: "found",
            records: [{ file: "docs/decisions/0002-café.md", title: "2. Café", isProposed: false }],
        });
    });

    it("reads the status from the first non-empty line after the Status heading", async () => {
        await createRepository();
        await commit(
            dir,
            {
                "docs/decisions/0002-later.md": "# 2. Later\n\n## Status\n\n\n\nProposed by Claude at autonomous\n",
                "docs/decisions/0003-quoted.md": "# 3. Quoted\n\n## Status\n\nAccepted. Proposed earlier as ADR 2.\n",
            },
            "Decide",
        );

        const result = await addedDecisionRecords(dir, { base: "main", signal: testSignal() });

        expect(result).toEqual({
            kind: "found",
            records: [
                { file: "docs/decisions/0002-later.md", title: "2. Later", isProposed: true },
                { file: "docs/decisions/0003-quoted.md", title: "3. Quoted", isProposed: false },
            ],
        });
    });

    it("lists the records under a project folder inside a larger repository, relative to that folder", async () => {
        await createRepository();
        await commit(
            dir,
            {
                "docs/decisions/0002-at-the-root.md": buildRecord({ title: "2. At the root" }),
                "app/docs/decisions/0001-in-the-app.md": buildRecord({ title: "1. In the app" }),
            },
            "Decide",
        );

        const result = await addedDecisionRecords(path.join(dir, "app"), { base: "main", signal: testSignal() });

        expect(result).toEqual({
            kind: "found",
            records: [{ file: "docs/decisions/0001-in-the-app.md", title: "1. In the app", isProposed: false }],
        });
    });

    it("uses the repository of the project folder, not one named by an inherited GIT_DIR", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0002-here.md": buildRecord({ title: "2. Here" }) }, "Decide");
        const other = path.join(dir, "other");
        await mkdir(other);
        git(other, "init", "--quiet", "--initial-branch=main");
        const inherited = process.env["GIT_DIR"];
        process.env["GIT_DIR"] = path.join(other, ".git");

        try {
            const result = await addedDecisionRecords(dir, { base: "main", signal: testSignal() });

            expect(result).toEqual({
                kind: "found",
                records: [{ file: "docs/decisions/0002-here.md", title: "2. Here", isProposed: false }],
            });
        } finally {
            if (inherited === undefined) {
                delete process.env["GIT_DIR"];
            } else {
                process.env["GIT_DIR"] = inherited;
            }
        }
    });

    it("AC-5: reports a base branch that doesn't exist, naming it", async () => {
        await createRepository();

        expect(await addedDecisionRecords(dir, { base: "no-such-branch", signal: testSignal() })).toEqual({
            kind: "unknown-base",
            base: "no-such-branch",
        });
    });

    it("reports a base that names something other than a commit as unknown", async () => {
        await createRepository();
        const file = "main:docs/decisions/0001-use-bun.md";

        expect(await addedDecisionRecords(dir, { base: file, signal: testSignal() })).toEqual({
            kind: "unknown-base",
            base: file,
        });
    });

    it("refuses a base that starts with '-' before running git, so it can't be read as an option", async () => {
        await createRepository();
        const target = path.join(dir, "written-by-git");

        await expect(addedDecisionRecords(dir, { base: `--output=${target}`, signal: testSignal() })).rejects.toThrow(
            `The base branch "--output=${target}" starts with "-"`,
        );
        expect(await Bun.file(target).exists()).toBe(false);
    });

    it("refuses an empty or blank base", async () => {
        await createRepository();

        await expect(addedDecisionRecords(dir, { base: "", signal: testSignal() })).rejects.toThrow(
            "The base branch is empty",
        );
        await expect(addedDecisionRecords(dir, { base: "  ", signal: testSignal() })).rejects.toThrow(
            "The base branch is empty",
        );
    });

    it(`accepts ${DECISION_RECORDS_MAX} records, the limit`, async () => {
        await createRepository();
        const records = Object.fromEntries(
            Array.from({ length: DECISION_RECORDS_MAX }, (_, index) => [
                `docs/decisions/${String(index + 2).padStart(4, "0")}-decision.md`,
                buildRecord({ title: `${index + 2}. Decision` }),
            ]),
        );
        await commit(dir, records, "Many decisions");

        const result = await addedDecisionRecords(dir, { base: "main", signal: testSignal() });

        assert(result.kind === "found", "the base exists");
        expect(result.records).toHaveLength(DECISION_RECORDS_MAX);
    });

    it(`refuses more than ${DECISION_RECORDS_MAX} records`, async () => {
        await createRepository();
        const records = Object.fromEntries(
            Array.from({ length: DECISION_RECORDS_MAX + 1 }, (_, index) => [
                `docs/decisions/${String(index + 2).padStart(4, "0")}-decision.md`,
                buildRecord({ title: `${index + 2}. Decision` }),
            ]),
        );
        await commit(dir, records, "Too many decisions");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            `The branch adds ${DECISION_RECORDS_MAX + 1} decision records, more than the limit of ${DECISION_RECORDS_MAX}`,
        );
    });

    it("fails when git's output is over its limit of 1 MiB, instead of reading the rest", async () => {
        await createRepository();
        // 5,000 paths of about 225 bytes each: just over 1 MiB of `git diff` output.
        const name = "x".repeat(200);
        const files = Object.fromEntries(
            Array.from({ length: 5_000 }, (_, index) => [`docs/decisions/${index}-${name}.txt`, ""]),
        );
        await commit(dir, files, "Many files");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            "git diff's output is over the limit of 1048576 bytes",
        );
    });

    it("refuses a record that is a symbolic link to a file outside the repository, without reading it", async () => {
        const outside = await mkdtemp(path.join(tmpdir(), "decision-records-outside-"));

        try {
            await Bun.write(path.join(outside, "secret.md"), buildRecord({ title: "Secret heading" }));
            await createRepository();
            await mkdir(path.join(dir, "docs/decisions"), { recursive: true });
            await symlink(path.join(outside, "secret.md"), path.join(dir, "docs/decisions/0002-link.md"));
            await commit(dir, {}, "Link");

            const error = await addedDecisionRecords(dir, { base: "main", signal: testSignal() }).catch(
                (caught: unknown) => caught,
            );

            expect(error).toBeInstanceOf(Error);
            assert(error instanceof Error, "rejected with an Error");
            expect(error.message).toBe(
                "docs/decisions/0002-link.md is a symbolic link, not a regular file: a decision record must be a regular file",
            );
            expect(error.message).not.toContain("Secret heading");
        } finally {
            await rm(outside, { recursive: true, force: true });
        }
    });

    it("refuses a record that is a symbolic link to /dev/zero", async () => {
        await createRepository();
        await mkdir(path.join(dir, "docs/decisions"), { recursive: true });
        await symlink("/dev/zero", path.join(dir, "docs/decisions/0002-zero.md"));
        await commit(dir, {}, "Link");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            "docs/decisions/0002-zero.md is a symbolic link, not a regular file",
        );
    }, 2_000);

    it("refuses a record that is a submodule, naming it", async () => {
        await createRepository();
        const head = git(dir, "rev-parse", "HEAD").trim();
        git(dir, "update-index", "--add", "--cacheinfo", `160000,${head},docs/decisions/0002-module.md`);
        git(dir, "commit", "--quiet", "--message=Submodule");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            "docs/decisions/0002-module.md is a submodule, not a regular file",
        );
    });

    it("accepts an executable record, which is still a regular file", async () => {
        await createRepository();
        await Bun.write(path.join(dir, "docs/decisions/0002-run.md"), buildRecord({ title: "2. Run" }));
        await chmod(path.join(dir, "docs/decisions/0002-run.md"), 0o755);
        await commit(dir, {}, "Decide");

        expect(await addedDecisionRecords(dir, { base: "main", signal: testSignal() })).toEqual({
            kind: "found",
            records: [{ file: "docs/decisions/0002-run.md", title: "2. Run", isProposed: false }],
        });
    });

    it("reads the records as committed, not as they are in the working tree", async () => {
        await createRepository();
        await commit(
            dir,
            {
                "docs/decisions/0002-edited.md": buildRecord({ title: "2. Committed", status: "Proposed" }),
                "docs/decisions/0003-removed.md": buildRecord({ title: "3. Removed" }),
            },
            "Decide",
        );
        await Bun.write(path.join(dir, "docs/decisions/0002-edited.md"), buildRecord({ title: "2. Uncommitted" }));
        await rm(path.join(dir, "docs/decisions/0003-removed.md"));

        expect(await addedDecisionRecords(dir, { base: "main", signal: testSignal() })).toEqual({
            kind: "found",
            records: [
                { file: "docs/decisions/0002-edited.md", title: "2. Committed", isProposed: true },
                { file: "docs/decisions/0003-removed.md", title: "3. Removed", isProposed: false },
            ],
        });
    });

    it("reads a record of exactly the size limit, and refuses one byte more, naming it", async () => {
        await createRepository();
        const record = buildRecord({ title: "2. Large" });
        await commit(
            dir,
            {
                "docs/decisions/0002-at-limit.md": record.padEnd(TEXT_BYTES_MAX, "x"),
                "docs/decisions/0003-over-limit.md": record.padEnd(TEXT_BYTES_MAX + 1, "x"),
            },
            "Decide",
        );

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            `docs/decisions/0003-over-limit.md is over the limit of ${TEXT_BYTES_MAX} bytes`,
        );
        git(dir, "rm", "--quiet", "docs/decisions/0003-over-limit.md");
        git(dir, "commit", "--quiet", "--message=Smaller");

        expect(await addedDecisionRecords(dir, { base: "main", signal: testSignal() })).toEqual({
            kind: "found",
            records: [{ file: "docs/decisions/0002-at-limit.md", title: "2. Large", isProposed: false }],
        });
    });

    it("fails on a record without a title, naming the file", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0002-untitled.md": "## Status\n\nAccepted\n" }, "Decide");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            'docs/decisions/0002-untitled.md has no title (a "# " heading)',
        );
    });

    it("fails on a record without a Status heading, naming the file", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0002-no-status.md": "# 2. No status\n\n## Context\n\nWhy.\n" }, "A");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            "docs/decisions/0002-no-status.md has no status (a line after its ## Status heading)",
        );
    });

    it("fails on a record whose Status section is empty, naming the file", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0002-empty.md": "# 2. Empty\n\n## Status\n\n## Context\n" }, "A");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            "docs/decisions/0002-empty.md has no status (a line after its ## Status heading)",
        );
    });

    it("fails with git's message outside a git repository", async () => {
        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            /not a git repository/i,
        );
    });

    it("fails with git's message when the base shares no history with the branch", async () => {
        await createRepository();
        git(dir, "switch", "--quiet", "--orphan", "unrelated");
        await commit(dir, { "docs/decisions/0002-orphan.md": buildRecord() }, "Unrelated");

        await expect(addedDecisionRecords(dir, { base: "main", signal: testSignal() })).rejects.toThrow(
            /git diff .*merge base/i,
        );
    });

    it("rejects with an AbortError when the signal is already aborted", async () => {
        await createRepository();
        const controller = new AbortController();
        controller.abort();

        await expect(addedDecisionRecords(dir, { base: "main", signal: controller.signal })).rejects.toMatchObject({
            name: "AbortError",
        });
    });

    it("rejects with an AbortError, not a partial result, when aborted while git runs", async () => {
        await createRepository();
        await commit(dir, { "docs/decisions/0002-use-zod.md": buildRecord({ title: "2. Use Zod" }) }, "Decide");
        const controller = new AbortController();

        const result = addedDecisionRecords(dir, { base: "main", signal: controller.signal });
        controller.abort();

        await expect(result).rejects.toMatchObject({ name: "AbortError" });
    });
});

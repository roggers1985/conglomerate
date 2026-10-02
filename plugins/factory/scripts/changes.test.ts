import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Stage, StageDocuments, TaskDocument } from "./changes.ts";
import {
    changesReminder,
    changesStatus,
    gateProblems,
    parseTaskDocument,
    resumePoint,
    STAGES,
    TRACKS,
} from "./changes.ts";

type StageEntry = TaskDocument["stages"][number];

const noDocuments: StageDocuments = {
    intent: null,
    spec: null,
    plan: null,
    tasks: null,
    verification: null,
    spike: null,
    review: null,
    securityReview: null,
};

const stage = (name: Stage, overrides: Partial<StageEntry> = {}): StageEntry => ({
    name,
    level: "guided",
    status: "pending",
    ...overrides,
});

const task = (overrides: Partial<TaskDocument> = {}): TaskDocument => ({
    title: "Export jobs as CSV",
    created: "2026-10-01",
    track: "standard",
    classification: {
        type: "feature",
        size: "medium",
        risk: "low",
        reversible: true,
        uncertainty: "low",
        architectureDebt: [],
    },
    stages: TRACKS.standard.map((name) => stage(name)),
    deviations: [],
    ...overrides,
});

const errorsOf = (value: unknown): readonly string[] => {
    const parsed = parseTaskDocument(value);

    return parsed.kind === "invalid" ? parsed.errors : [];
};

describe("parseTaskDocument", () => {
    it("accepts every track as it is defined", () => {
        for (const track of ["quick", "standard", "full"] as const) {
            expect(errorsOf(task({ track, stages: TRACKS[track].map((name) => stage(name)) }))).toEqual([]);
        }
    });

    it("accepts a deviation from the track, such as an added security review", () => {
        const stages = ["spec", "plan", "build", "security-review", "review", "finish"] as const;

        expect(errorsOf(task({ stages: stages.map((name) => stage(name)), deviations: ["handles uploads"] }))).toEqual(
            [],
        );
    });

    it("rejects stages out of order, or repeated", () => {
        const outOfOrder = task({
            stages: [stage("plan"), stage("spec"), stage("build"), stage("review"), stage("finish")],
        });
        const repeated = task({
            stages: [stage("spec"), stage("spec"), stage("plan"), stage("build"), stage("review"), stage("finish")],
        });
        const message = `stages: stages must be unique and in this order: ${STAGES.join(", ")}`;

        expect(errorsOf(outOfOrder)).toEqual([message]);
        expect(errorsOf(repeated)).toEqual([message]);
    });

    it("allows one stage in progress, not two", () => {
        const stages = [stage("spec", { status: "done" }), stage("plan", { status: "in-progress" })];
        const rest = [stage("build"), stage("review"), stage("finish")];

        expect(errorsOf(task({ stages: [...stages, ...rest] }))).toEqual([]);
        expect(
            errorsOf(
                task({
                    stages: [
                        stage("spec", { status: "in-progress" }),
                        stage("plan", { status: "in-progress" }),
                        ...rest,
                    ],
                }),
            ),
        ).toEqual(["stages: at most one stage can be in progress"]);
    });

    it("rejects a stage started or done after a pending one, but allows skipped stages anywhere", () => {
        const startedEarly = [
            stage("spec"),
            stage("plan", { status: "done" }),
            stage("build"),
            stage("review"),
            stage("finish"),
        ];
        const skipped = [
            stage("spec", { status: "skipped" }),
            stage("plan", { status: "done" }),
            stage("build"),
            stage("review"),
            stage("finish"),
        ];

        expect(errorsOf(task({ stages: startedEarly }))).toEqual([
            "stages: a stage can't be started or done while an earlier stage is still pending",
        ]);
        expect(errorsOf(task({ stages: skipped }))).toEqual([]);
    });

    it("requires a plan before building, except on the quick track", () => {
        const withoutPlan = [stage("spec"), stage("build"), stage("review"), stage("finish")];

        expect(errorsOf(task({ stages: withoutPlan }))).toEqual([
            "stages: a route that builds needs a plan first (except on the quick track)",
        ]);
        expect(errorsOf(task({ track: "quick", stages: TRACKS.quick.map((name) => stage(name)) }))).toEqual([]);
    });

    it("requires a review after building, and finish at the end outside the quick track", () => {
        expect(errorsOf(task({ stages: [stage("spec"), stage("plan"), stage("build"), stage("finish")] }))).toEqual([
            "stages: a route that builds needs a review",
        ]);
        expect(errorsOf(task({ stages: [stage("spec"), stage("plan"), stage("build"), stage("review")] }))).toEqual([
            "stages: the route must end with finish",
        ]);
    });

    it("keeps intent and spec at guided, whatever the other stages' levels", () => {
        const stages = [
            stage("intent", { level: "trusted" }),
            stage("spec", { level: "autonomous" }),
            stage("plan", { level: "autonomous" }),
        ];
        const rest = [stage("build", { level: "autonomous" }), stage("review"), stage("finish")];

        expect(errorsOf(task({ track: "full", stages: [...stages, ...rest] }))).toEqual([
            "stages: intent is the owner's, so it always runs at guided",
            "stages: spec is the owner's, so it always runs at guided",
        ]);
    });

    it("needs at least one stage, and accepts at most one of each", () => {
        expect(errorsOf(task({ stages: [] })).length).toBeGreaterThan(0);
        expect(parseTaskDocument(task({ track: "full", stages: STAGES.map((name) => stage(name)) })).kind).toBe(
            "valid",
        );
    });

    it("bounds the title, the deviations and the debt list, and rejects blank text", () => {
        const deviations = (count: number) => Array.from({ length: count }, (_, index) => `deviation ${index}`);

        expect(errorsOf(task({ title: "x".repeat(200) }))).toEqual([]);
        expect(errorsOf(task({ title: "x".repeat(201) }))).toEqual(["title: must be at most 200 characters"]);
        expect(errorsOf(task({ title: "  " }))).toEqual(["title: is required"]);
        expect(errorsOf(task({ deviations: deviations(20) }))).toEqual([]);
        expect(errorsOf(task({ deviations: deviations(21) })).length).toBe(1);
    });

    it("rejects a malformed date and unknown keys, which are usually typos", () => {
        expect(errorsOf(task({ created: "1 October" }))).toEqual(["created: must be a date as YYYY-MM-DD"]);
        expect(errorsOf({ ...task(), trak: "quick" }).join("\n")).toContain('"trak"');
    });
});

describe("resumePoint", () => {
    it("resumes at the stage in progress, else the first pending one, else nowhere", () => {
        expect(
            resumePoint([stage("spec", { status: "done" }), stage("plan", { status: "in-progress" }), stage("build")])
                ?.name,
        ).toBe("plan");
        expect(
            resumePoint([stage("spec", { status: "done" }), stage("plan", { status: "skipped" }), stage("build")])
                ?.name,
        ).toBe("build");
        expect(resumePoint([stage("spec", { status: "done" }), stage("finish", { status: "skipped" })])).toBeNull();
    });
});

describe("gateProblems", () => {
    const withDone = (...done: readonly Stage[]): Pick<TaskDocument, "stages"> => ({
        stages: TRACKS.full.map((name) => stage(name, { status: done.includes(name) ? "done" : "pending" })),
    });

    it("checks nothing while no gated stage is done", () => {
        expect(gateProblems(withDone(), { ...noDocuments })).toEqual([]);
    });

    it("reports a missing document for a stage that is done", () => {
        expect(gateProblems(withDone("intent", "spec"), { ...noDocuments })).toEqual([
            "intent is done, but intent.md is missing",
            "spec is done, but spec.md is missing",
        ]);
    });

    it("applies the stage's gate to its document", () => {
        expect(gateProblems(withDone("intent"), { ...noDocuments, intent: "## Problem\n\nSlow.\n" })).toContain(
            'intent.md has no "## Outcome" section',
        );
    });

    it("on the standard track, checks the plan's own Tasks section against the spec's criteria", () => {
        const route = {
            stages: TRACKS.standard.map((name) =>
                stage(name, { status: ["spec", "plan"].includes(name) ? "done" : "pending" }),
            ),
        };
        const spec =
            "## Acceptance criteria\n\n- **AC-1**: THE SYSTEM SHALL export.\n- **AC-2**: THE SYSTEM SHALL log.";
        const plan = ["Approach", "Files and data", "Trade-offs", "Costs", "Conventions and decisions"]
            .map((heading) => `## ${heading}\n\nSomething.`)
            .concat(
                "## Tasks\n\n### T-1: Export\n- Files: `a.ts`\n- Covers: AC-1\n- Verify: `bun test`\n- Status: pending",
            )
            .join("\n\n");

        expect(
            gateProblems(route, {
                intent: null,
                spec,
                plan,
                tasks: null,
                verification: null,
                spike: null,
                review: null,
                securityReview: null,
            }),
        ).toContain("AC-2 isn't covered by any task in plan.md's Tasks section");
    });

    it("refuses a build marked done while a task isn't", () => {
        const route = {
            stages: TRACKS.full.map((name) => stage(name, { status: name === "build" ? "done" : "skipped" })),
        };
        const tasks = "### T-1: Export\n- Status: in-progress";

        expect(
            gateProblems(route, {
                intent: null,
                spec: null,
                plan: null,
                tasks,
                verification: null,
                spike: null,
                review: null,
                securityReview: null,
            }),
        ).toEqual([
            "the build is done, but T-1 in tasks.md is in-progress",
            "build is done, but verification.md is missing",
        ]);
    });

    it("requires evidence for every criterion, and a spike's findings, once those stages are done", () => {
        const done = new Set(["spike", "verify"]);
        const route = {
            stages: (["spec", "spike", "plan", "build", "verify", "review", "finish"] as const).map((name) =>
                stage(name, { status: done.has(name) ? "done" : "skipped" }),
            ),
        };
        const spec = "## Acceptance criteria\n\n- **AC-1**: THE SYSTEM SHALL export.";
        const verification = "## Checks\n\n`bun run check`: passed\n\n## Evidence\n\n- AC-1:";

        expect(
            gateProblems(route, {
                intent: null,
                spec,
                plan: null,
                tasks: null,
                verification,
                spike: null,
                review: null,
                securityReview: null,
            }),
        ).toEqual(["spike is done, but spike.md is missing", "verification.md has no evidence for AC-1"]);
    });

    it("requires the review documents once the review stages are done", () => {
        const route = {
            stages: (["spec", "plan", "build", "security-review", "review", "finish"] as const).map((name) =>
                stage(name, { status: name.includes("review") ? "done" : "skipped" }),
            ),
        };

        expect(gateProblems(route, noDocuments)).toEqual([
            "security-review is done, but security-review.md is missing",
            "review is done, but review.md is missing",
        ]);
    });

    it("names the verify stage when it is the one that asks for verification.md", () => {
        const route = {
            stages: (["plan", "build", "verify", "review", "finish"] as const).map((name) =>
                stage(name, { status: name === "verify" ? "done" : "skipped" }),
            ),
        };

        expect(gateProblems(route, noDocuments)).toEqual(["verify is done, but verification.md is missing"]);
    });

    it("asks the spec for a Problem section when the route has no intent stage", () => {
        const route = {
            stages: TRACKS.standard.map((name) => stage(name, { status: name === "spec" ? "done" : "pending" })),
        };

        expect(gateProblems(route, { ...noDocuments, spec: "" })).toContain('spec.md has no "## Problem" section');
    });
});

describe("changesStatus and changesReminder", () => {
    const finished = task({ stages: TRACKS.standard.map((name) => stage(name, { status: "done" })) });

    it("lists only the unfinished changes, and the invalid ones below them", () => {
        const status = changesStatus([
            { kind: "valid", name: "2026-10-01-done", task: finished },
            { kind: "valid", name: "2026-10-02-open", task: task() },
            { kind: "invalid", name: "2026-10-03-broken", errors: ["has no task.md"] },
        ]);

        expect(status).not.toContain("2026-10-01-done");
        expect(status).toContain("| 2026-10-02-open | Export jobs as CSV | standard | spec (pending, guided) |");
        expect(status).toContain("- `2026-10-03-broken`: has no task.md");
    });

    it("says so when nothing is unfinished", () => {
        expect(changesStatus([{ kind: "valid", name: "2026-10-01-done", task: finished }])).toBe(
            "No unfinished changes in `docs/changes/`.",
        );
    });

    it("stays silent at session start when nothing is unfinished, and asks before resuming otherwise", () => {
        expect(changesReminder([{ kind: "valid", name: "done", task: finished }])).toBeNull();

        const reminder = changesReminder([{ kind: "valid", name: "2026-10-02-open", task: task() }]);

        expect(reminder?.systemMessage).toBe(
            "Changes: 1 unfinished, 0 with an invalid task.md. Run the factory's changes status for details.",
        );
        expect(reminder?.hookSpecificOutput.additionalContext).toContain("Don't resume without the owner's go-ahead.");
    });
});

describe("changes CLI", () => {
    const script = path.join(import.meta.dir, "changes.ts");
    let projectDir = "";

    afterEach(async () => {
        await rm(projectDir, { recursive: true, force: true });
    });

    const run = async (
        ...args: string[]
    ): Promise<{ readonly stdout: string; readonly stderr: string; readonly exitCode: number }> => {
        const cli = Bun.spawn(["bun", script, ...args], { stdout: "pipe", stderr: "pipe" });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(cli.stdout).text(),
            new Response(cli.stderr).text(),
            cli.exited,
        ]);

        return { stdout, stderr, exitCode };
    };

    const writeTask = (name: string, content: string): Promise<number> =>
        Bun.write(path.join(projectDir, "docs/changes", name, "task.md"), content);

    const asMarkdown = (document: TaskDocument): string =>
        `---\n${JSON.stringify(document, null, 2)}\n---\n\n# ${document.title}\n`;

    it("checks a valid task document, and rejects an invalid one with its problems", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "changes-"));
        await writeTask("good", asMarkdown(task()));
        await writeTask("bad", asMarkdown(task({ stages: [stage("build")] })));

        const good = await run("check", path.join(projectDir, "docs/changes/good/task.md"));
        const bad = await run("check", path.join(projectDir, "docs/changes/bad/task.md"));

        expect(good.exitCode).toBe(0);
        expect(good.stdout).toContain("✓ valid route: spec → plan → build → review → finish");
        expect(bad.exitCode).toBe(1);
        expect(bad.stderr).toContain("✗ stages: a route that builds needs a plan first");
    });

    it("reports folders without a task.md, and task documents that aren't valid YAML", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "changes-"));
        await mkdir(path.join(projectDir, "docs/changes/empty"), { recursive: true });
        await writeTask("broken", "---\ntitle: Go. Use when: writing Go.\n---\n");

        const { stdout } = await run("status", projectDir);

        expect(stdout).toContain("- `broken`: task.md's frontmatter is not valid YAML");
        expect(stdout).toContain("- `empty`: has no task.md");
    });

    it("refuses a route whose spec is done while spec.md is missing", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "changes-"));
        const stages = TRACKS.standard.map((name) => stage(name, { status: name === "spec" ? "done" : "pending" }));
        await writeTask("specced", asMarkdown(task({ stages })));

        const result = await run("check", path.join(projectDir, "docs/changes/specced/task.md"));

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("✗ spec is done, but spec.md is missing");
    });

    it("skips the gates of finished changes at session start, but not in an explicit check", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "changes-"));
        const stages = TRACKS.standard.map((name) => stage(name, { status: "done" }));
        await writeTask("finished", asMarkdown(task({ stages })));

        const status = await run("status", projectDir);
        const check = await run("check", path.join(projectDir, "docs/changes/finished/task.md"));

        expect(status.stdout).toBe("No unfinished changes in `docs/changes/`.\n");
        expect(check.exitCode).toBe(1);
        expect(check.stderr).toContain("✗ spec is done, but spec.md is missing");
    });

    it("prints nothing at session start in a project without changes", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "changes-"));

        expect((await run("reminder", projectDir)).stdout).toBe("");
    });

    it("reminds about an unfinished change at session start", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "changes-"));
        await writeTask("2026-10-02-open", asMarkdown(task()));

        const output = JSON.parse((await run("reminder", projectDir)).stdout);

        expect(output.systemMessage).toContain("1 unfinished");
    });
});

describe("changes pr-body CLI", () => {
    const script = path.join(import.meta.dir, "changes.ts");
    const Change = "docs/changes/2026-10-02-export";
    const Author = ["-c", "user.name=Test", "-c", "user.email=test@example.com"];
    let dir = "";

    // The test repository gets a minimal environment: HOME is the temporary folder, so git reads no user
    // configuration, and no GIT_DIR from a surrounding hook leaks in.
    // biome-ignore lint/style/useNamingConvention: environment variable names are uppercase by convention.
    const environment = (): Record<string, string> => ({ HOME: dir, PATH: process.env["PATH"] ?? "" });

    const git = (...args: readonly string[]): void => {
        const result = Bun.spawnSync(["git", ...Author, ...args], {
            cwd: dir,
            env: environment(),
            stdout: "pipe",
            stderr: "pipe",
        });

        if (result.exitCode !== 0) {
            throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
        }
    };

    const run = async (
        ...args: string[]
    ): Promise<{ readonly stdout: string; readonly stderr: string; readonly exitCode: number }> => {
        const cli = Bun.spawn(["bun", script, "pr-body", ...args], {
            cwd: dir,
            env: environment(),
            stdout: "pipe",
            stderr: "pipe",
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(cli.stdout).text(),
            new Response(cli.stderr).text(),
            cli.exited,
        ]);

        return { stdout, stderr, exitCode };
    };

    const Spec = [
        "## Problem",
        "",
        "Exports are manual.",
        "",
        "## Current behaviour",
        "",
        "Nothing exports.",
        "",
        "## Acceptance criteria",
        "",
        "- **AC-1**: WHEN asked, THE SYSTEM SHALL export jobs as CSV.",
        "",
        "## Edge cases",
        "",
        "None.",
        "",
        "## Limits",
        "",
        "One file.",
        "",
        "## Security",
        "",
        "- Authentication: none, local tool",
        "- Authorisation: none, local tool",
        "- Untrusted input: none",
        "- Sensitive data: none",
        "",
        "## Out of scope",
        "",
        "Imports.",
        "",
    ].join("\n");
    const Verification = "## Checks\n\n`bun test`: passed\n\n## Evidence\n\n- AC-1: `export.test.ts` exports as CSV\n";
    const Review = "## Summary\n\nReads well, no blockers.\n\n## Findings\n\nNone.\n";
    const Adr = "# 57. Export as CSV\n\nDate: 2026-10-02\n\n## Status\n\nAccepted\n\n## Context\n\nWhy.\n";

    const routeOf = (statuses: Readonly<Partial<Record<Stage, StageEntry["status"]>>>): TaskDocument =>
        task({
            stages: (["spec", "plan", "build", "review", "finish"] as const).map((name) =>
                stage(name, { status: statuses[name] ?? (name === "plan" ? "skipped" : "done") }),
            ),
        });

    const asMarkdown = (document: TaskDocument): string =>
        `---\n${JSON.stringify(document, null, 2)}\n---\n\n# ${document.title}\n`;

    // A repository with `main`, and a branch `change` that adds the change's folder and a decision record.
    async function createChange(document: TaskDocument, files: Readonly<Record<string, string>> = {}): Promise<void> {
        dir = await mkdtemp(path.join(tmpdir(), "changes-pr-body-"));
        git("init", "--quiet", "--initial-branch=main");
        git("commit", "--quiet", "--allow-empty", "--message=Start");
        git("switch", "--quiet", "--create", "change");

        const all: Record<string, string> = {
            [`${Change}/task.md`]: asMarkdown(document),
            [`${Change}/spec.md`]: Spec,
            [`${Change}/verification.md`]: Verification,
            [`${Change}/review.md`]: Review,
            "docs/decisions/0057-export-as-csv.md": Adr,
            ...files,
        };

        await Promise.all(Object.entries(all).map(([file, content]) => Bun.write(path.join(dir, file), content)));
        git("add", "--all");
        git("commit", "--quiet", "--message=Build");
    }

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("AC-1: prints the route, each criterion with its evidence, the review summary and the added decision", async () => {
        await createChange(routeOf({ finish: "in-progress" }));

        const result = await run(Change);

        expect(result.stderr).toBe("");
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(
            "spec (done) → plan (skipped) → build (done) → review (done) → finish (in-progress)",
        );
        expect(result.stdout).toContain("**AC-1**: WHEN asked, THE SYSTEM SHALL export jobs as CSV.");
        expect(result.stdout).toContain("Evidence: `export.test.ts` exports as CSV");
        expect(result.stdout).toContain("Reads well, no blockers.");
        expect(result.stdout).toContain("- 57. Export as CSV (`docs/decisions/0057-export-as-csv.md`)");
    });

    it("AC-1: compares with the branch given by --base", async () => {
        await createChange(routeOf({ finish: "pending" }));
        git("branch", "release", "main");

        const result = await run(Change, "--base", "release");

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("57. Export as CSV");
    });

    it("AC-6: refuses while a stage before finish is pending, naming it, and prints nothing", async () => {
        await createChange(routeOf({ review: "pending", finish: "pending" }));

        const result = await run(Change);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("review (pending) before finish");
    });

    it("AC-6: refuses while a stage before finish is in progress, naming it", async () => {
        await createChange(routeOf({ build: "in-progress", review: "pending", finish: "pending" }));

        const result = await run(Change);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("build (in-progress), review (pending) before finish");
    });

    it("AC-7: refuses a done stage whose document fails its gate, with the gate's problem", async () => {
        await createChange(routeOf({ finish: "in-progress" }), {
            [`${Change}/verification.md`]: "## Checks\n\nok\n\n## Evidence\n\n",
        });

        const result = await run(Change);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("✗ verification.md has no evidence for AC-1");
    });

    it("refuses a base branch that doesn't exist, naming it", async () => {
        await createChange(routeOf({ finish: "in-progress" }));

        const result = await run(Change, "--base", "release");

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain('the base branch "release" doesn\'t exist');
    });

    it("refuses a --base without a value, or with a blank value or one starting with -", async () => {
        await createChange(routeOf({ finish: "in-progress" }));

        for (const args of [
            [Change, "--base"],
            [Change, "--base", " "],
            [Change, "--base", "--help"],
        ]) {
            const result = await run(...args);

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toBe("");
            expect(result.stderr).toContain("--base needs a branch name");
        }
    });

    it("refuses an unknown option, a missing folder, and a folder without a task.md", async () => {
        await createChange(routeOf({ finish: "in-progress" }));

        const unknownOption = await run(Change, "--branch", "main");
        const noFolder = await run();
        const noTask = await run("docs/changes/nothing-here");

        expect(unknownOption.stderr).toContain("unknown option --branch");
        expect(unknownOption.stderr).toContain("Usage:");
        expect(noFolder.stderr).toContain("pr-body needs the change folder");
        expect(noTask.stderr).toContain("✗ has no task.md");

        for (const result of [unknownOption, noFolder, noTask]) {
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toBe("");
        }
    });
});

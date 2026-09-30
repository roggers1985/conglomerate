import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Stage, TaskDocument } from "./changes.ts";
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
        expect(gateProblems(withDone(), { intent: null, spec: null })).toEqual([]);
    });

    it("reports a missing document for a stage that is done", () => {
        expect(gateProblems(withDone("intent", "spec"), { intent: null, spec: null })).toEqual([
            "intent is done, but intent.md is missing",
            "spec is done, but spec.md is missing",
        ]);
    });

    it("applies the stage's gate to its document", () => {
        expect(gateProblems(withDone("intent"), { intent: "## Problem\n\nSlow.\n", spec: null })).toContain(
            'intent.md has no "## Outcome" section',
        );
    });

    it("asks the spec for a Problem section when the route has no intent stage", () => {
        const route = {
            stages: TRACKS.standard.map((name) => stage(name, { status: name === "spec" ? "done" : "pending" })),
        };

        expect(gateProblems(route, { intent: null, spec: "" })).toContain('spec.md has no "## Problem" section');
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

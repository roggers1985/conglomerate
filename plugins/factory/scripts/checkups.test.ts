import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CheckupStatus } from "./checkups.ts";
import {
    buildReminder,
    checkupStatus,
    formatDate,
    isDue,
    latestReportDate,
    parseSchedule,
    reminderOutput,
    statusReport,
} from "./checkups.ts";

const legal = { name: "legal", intervalDays: 30, priority: true };
const seo = { name: "seo", intervalDays: 60, priority: false };

const status = (overrides: Partial<CheckupStatus>): CheckupStatus => ({
    ...seo,
    lastRun: null,
    due: false,
    ...overrides,
});

/** The paths of the fields that failed, so tests don't depend on the schema library's wording. */
const failedPaths = (parsed: ReturnType<typeof parseSchedule>): string[] =>
    parsed.kind === "invalid" ? parsed.errors.map((error) => error.split(": ")[0] ?? error) : [];

describe("parseSchedule", () => {
    it("accepts a valid schedule", () => {
        expect(parseSchedule({ checkups: [legal, seo] })).toEqual({ kind: "valid", value: [legal, seo] });
    });

    it("rejects a schedule without a checkups array", () => {
        expect(failedPaths(parseSchedule({ checkups: "legal" }))).toEqual(["checkups"]);
    });

    it("reports every invalid field", () => {
        expect(
            failedPaths(parseSchedule({ checkups: [{ name: "Legal", intervalDays: 1.5, priority: "yes" }, 42] })),
        ).toEqual(["checkups[0].name", "checkups[0].intervalDays", "checkups[0].priority", "checkups[1]"]);
    });

    it("rejects unknown fields, which are usually typos", () => {
        const parsed = parseSchedule({ checkups: [{ ...legal, intervalDay: 30 }] });

        expect(parsed.kind === "invalid" && parsed.errors[0]).toContain('"intervalDay"');
    });

    it("rejects a checkup that is listed twice", () => {
        expect(parseSchedule({ checkups: [legal, legal] })).toEqual({
            kind: "invalid",
            errors: ['checkups: "legal" is listed more than once'],
        });
    });
});

describe("latestReportDate", () => {
    it("picks the newest report", () => {
        expect(latestReportDate(["2026-01-05.md", "2026-09-27.md", "2026-03-01.md"])).toBe("2026-09-27");
    });

    it("ignores files that are not dated reports", () => {
        expect(latestReportDate(["notes.md", "2026-09-27.txt", ".DS_Store"])).toBeNull();
    });
});

describe("isDue", () => {
    it("is due when the checkup never ran", () => {
        expect(isDue(null, 30, "2026-09-29")).toBe(true);
    });

    it("is due once the interval has passed", () => {
        expect(isDue("2026-08-30", 30, "2026-09-29")).toBe(true);
    });

    it("is not due before the interval has passed", () => {
        expect(isDue("2026-08-31", 30, "2026-09-29")).toBe(false);
    });

    it("refuses a malformed date", () => {
        expect(() => isDue(null, 30, "yesterday")).toThrow(/YYYY-MM-DD/);
    });
});

describe("checkupStatus", () => {
    it("takes the last run from the newest report", () => {
        expect(checkupStatus(legal, ["2026-09-27.md"], "2026-09-29")).toEqual({
            ...legal,
            lastRun: "2026-09-27",
            due: false,
        });
    });
});

describe("buildReminder", () => {
    it("stays silent when nothing is due", () => {
        expect(buildReminder([status({ due: false })])).toBeNull();
    });

    it("asks Claude to offer overdue priority checkups first", () => {
        const reminder = buildReminder([
            status({ ...legal, lastRun: "2026-08-01", due: true }),
            status({ ...seo, due: true }),
        ]);

        expect(reminder?.notice).toContain("- legal: last run 2026-08-01, due every 30 days");
        expect(reminder?.notice).toContain("Also due: seo.");
        expect(reminder?.context).toContain("offer to run the priority checkups first");
    });

    it("only mentions other due checkups quietly", () => {
        const reminder = buildReminder([status({ ...seo, due: true })]);

        expect(reminder?.notice).toBe("Checkups due: seo. Run /factory:checkup when convenient.");
        expect(reminder?.context).toContain("Don't bring it up unless the user asks");
    });
});

describe("reminderOutput", () => {
    it("stays silent in a project without a schedule", () => {
        expect(reminderOutput({ kind: "unscheduled" })).toBeNull();
    });

    it("warns about an invalid schedule", () => {
        const output = reminderOutput({ kind: "invalid", errors: ["is not valid JSON"] });

        expect(output?.systemMessage).toBe("Checkups: docs/checkups/checkups.json is invalid: is not valid JSON");
    });
});

describe("statusReport", () => {
    it("shows a table with the due checkups marked", () => {
        const report = statusReport(
            {
                kind: "scheduled",
                statuses: [status({ ...legal, lastRun: "2026-09-27", due: false }), status({ due: true })],
            },
            "2026-09-29",
        );

        expect(report).toContain("| legal | yes | 30 days | 2026-09-27 |  |");
        expect(report).toContain("| seo |  | 60 days | never | **due** |");
    });

    it("explains when nothing is scheduled", () => {
        expect(statusReport({ kind: "unscheduled" }, "2026-09-29")).toContain("does not exist");
    });
});

describe("checkups CLI", () => {
    const script = path.join(import.meta.dir, "checkups.ts");
    let projectDir = "";

    const run = async (command: string): Promise<string> => {
        const cli = Bun.spawn(["bun", script, command, projectDir], { stdout: "pipe" });
        const [stdout, exitCode] = await Promise.all([new Response(cli.stdout).text(), cli.exited]);

        expect(exitCode).toBe(0);
        return stdout;
    };

    const createProject = async (checkups: readonly object[], reports: Record<string, string[]>): Promise<void> => {
        projectDir = await mkdtemp(path.join(tmpdir(), "checkups-"));
        await Bun.write(path.join(projectDir, "docs/checkups/checkups.json"), JSON.stringify({ checkups }));

        for (const [name, dates] of Object.entries(reports)) {
            await mkdir(path.join(projectDir, "docs/checkups", name), { recursive: true });
            await Promise.all(
                dates.map((date) => Bun.write(path.join(projectDir, "docs/checkups", name, `${date}.md`), "")),
            );
        }
    };

    afterEach(async () => {
        await rm(projectDir, { recursive: true, force: true });
    });

    it("reminds about an overdue priority checkup at session start", async () => {
        await createProject([legal, seo], { seo: [formatDate(new Date())] });

        const output = JSON.parse(await run("reminder"));

        expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
        expect(output.systemMessage).toContain("- legal: last run never");
        expect(output.systemMessage).not.toContain("seo");
    });

    it("prints nothing when nothing is due", async () => {
        await createProject([legal], { legal: [formatDate(new Date())] });

        expect(await run("reminder")).toBe("");
    });

    it("prints nothing in a project without checkups", async () => {
        projectDir = await mkdtemp(path.join(tmpdir(), "checkups-"));

        expect(await run("reminder")).toBe("");
    });

    it("prints the status table", async () => {
        await createProject([legal], {});

        expect(await run("status")).toContain("| legal | yes | 30 days | never | **due** |");
    });
});

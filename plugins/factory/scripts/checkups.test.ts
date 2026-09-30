import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CheckupStatus, ScheduleEntry } from "./checkups.ts";
import {
    buildReminder,
    checkupStatus,
    formatDate,
    isDue,
    latestReportDate,
    parseCheckupDefaults,
    parseSchedule,
    reminderOutput,
    resolveCheckup,
    skillSource,
    statusReport,
} from "./checkups.ts";

const legal = { name: "legal", intervalDays: 30, priority: "urgent" } as const;
const seo = { name: "seo", intervalDays: 60, priority: "normal" } as const;
const own = { hasOwnInterval: true, hasOwnPriority: true } as const;

const status = (overrides: Partial<CheckupStatus>): CheckupStatus => ({
    ...seo,
    hasOwnInterval: false,
    hasOwnPriority: false,
    lastRun: null,
    due: false,
    skill: "plugin",
    ...overrides,
});

/** The paths of the fields that failed, so tests don't depend on the schema library's wording. */
const failedPaths = (parsed: ReturnType<typeof parseSchedule>): string[] =>
    parsed.kind === "invalid" ? parsed.errors.map((error) => error.split(": ")[0] ?? error) : [];

describe("parseSchedule", () => {
    it("accepts a valid schedule", () => {
        expect(parseSchedule({ checkups: [legal, seo] })).toEqual({
            kind: "valid",
            value: { checkups: [legal, seo], declined: [] },
        });
    });

    it("rejects a schedule without a checkups array", () => {
        expect(failedPaths(parseSchedule({ checkups: "legal" }))).toEqual(["checkups"]);
    });

    it("reports every invalid field", () => {
        expect(
            failedPaths(parseSchedule({ checkups: [{ name: "Legal", intervalDays: 1.5, priority: "sometimes" }, 42] })),
        ).toEqual(["checkups[0].name", "checkups[0].intervalDays", "checkups[0].priority", "checkups[1]"]);
    });

    it("rejects unknown fields, which are usually typos", () => {
        const parsed = parseSchedule({ checkups: [{ ...legal, intervalDay: 30 }] });

        expect(parsed.kind === "invalid" && parsed.errors[0]).toContain('"intervalDay"');
    });

    it("keeps the declined checkups", () => {
        expect(parseSchedule({ checkups: [legal], declined: ["monitoring"] })).toEqual({
            kind: "valid",
            value: { checkups: [legal], declined: ["monitoring"] },
        });
    });

    it("rejects a checkup that is both scheduled and declined", () => {
        expect(parseSchedule({ checkups: [legal], declined: ["legal"] })).toEqual({
            kind: "invalid",
            errors: ['declined: "legal" is both scheduled and declined'],
        });
    });

    it("accepts up to 100 scheduled and 100 declined checkups, and no more", () => {
        const names = (prefix: string, count: number): string[] =>
            Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
        const scheduled = (count: number): ScheduleEntry[] =>
            names("checkup", count).map((name) => ({ ...legal, name }));

        expect(parseSchedule({ checkups: scheduled(100), declined: names("declined", 100) }).kind).toBe("valid");
        expect(failedPaths(parseSchedule({ checkups: scheduled(101) }))).toEqual(["checkups"]);
        expect(failedPaths(parseSchedule({ checkups: [], declined: names("declined", 101) }))).toEqual(["declined"]);
    });

    it("accepts an interval from 1 to 365 days, and nothing outside it", () => {
        const withInterval = (intervalDays: number) => parseSchedule({ checkups: [{ ...legal, intervalDays }] });

        expect(withInterval(1).kind).toBe("valid");
        expect(withInterval(365).kind).toBe("valid");
        expect(failedPaths(withInterval(0))).toEqual(["checkups[0].intervalDays"]);
        expect(failedPaths(withInterval(366))).toEqual(["checkups[0].intervalDays"]);
    });

    it("accepts names of up to 50 characters, scheduled or declined", () => {
        const name50 = "a".repeat(50);
        const name51 = "a".repeat(51);

        expect(parseSchedule({ checkups: [{ ...legal, name: name50 }], declined: [`b${name50.slice(1)}`] }).kind).toBe(
            "valid",
        );
        expect(failedPaths(parseSchedule({ checkups: [{ ...legal, name: name51 }] }))).toEqual(["checkups[0].name"]);
        expect(failedPaths(parseSchedule({ checkups: [], declined: [name51] }))).toEqual(["declined[0]"]);
    });

    it("rejects a checkup that is listed twice", () => {
        expect(parseSchedule({ checkups: [legal, legal] })).toEqual({
            kind: "invalid",
            errors: ['checkups: "legal" is listed more than once'],
        });
    });
});

describe("parseSchedule with defaults", () => {
    it("accepts an entry with only a name, or with only one of its values", () => {
        expect(parseSchedule({ checkups: [{ name: "security" }, { name: "seo", intervalDays: 14 }] }).kind).toBe(
            "valid",
        );
    });
});

describe("parseCheckupDefaults", () => {
    const frontmatter = (metadata: object) => ({ name: "checkup-seo", metadata });

    it("reads the interval and priority from the skill's metadata, ignoring its other fields", () => {
        expect(parseCheckupDefaults(frontmatter({ task: "checkup", intervalDays: 60, priority: "normal" }))).toEqual({
            kind: "valid",
            value: { intervalDays: 60, priority: "normal" },
        });
    });

    it("rejects missing or out-of-range defaults", () => {
        expect(parseCheckupDefaults(frontmatter({ priority: "normal" })).kind).toBe("invalid");
        expect(parseCheckupDefaults(frontmatter({ intervalDays: 0, priority: "normal" })).kind).toBe("invalid");
        expect(parseCheckupDefaults(frontmatter({ intervalDays: 366, priority: "normal" })).kind).toBe("invalid");
        expect(parseCheckupDefaults(frontmatter({ intervalDays: 30, priority: "sometimes" })).kind).toBe("invalid");
        expect(parseCheckupDefaults(null).kind).toBe("invalid");
    });
});

describe("resolveCheckup", () => {
    const defaults = { intervalDays: 30, priority: "urgent" } as const;

    it("uses the skill's defaults for what the schedule leaves out", () => {
        expect(resolveCheckup({ name: "security" }, { defaults })).toEqual({
            kind: "valid",
            value: { name: "security", ...defaults, hasOwnInterval: false, hasOwnPriority: false },
        });
    });

    it("lets the schedule's own values win, and marks them", () => {
        expect(resolveCheckup({ name: "security", intervalDays: 7, priority: "quiet" }, { defaults })).toEqual({
            kind: "valid",
            value: { name: "security", intervalDays: 7, priority: "quiet", hasOwnInterval: true, hasOwnPriority: true },
        });
    });

    it("needs no defaults when the schedule sets both values", () => {
        expect(resolveCheckup({ ...legal }, { defaults: null })).toEqual({
            kind: "valid",
            value: { ...legal, ...own },
        });
    });

    it("reports a value that is missing from both", () => {
        expect(resolveCheckup({ name: "legal" }, { defaults: null })).toEqual({
            kind: "invalid",
            errors: ['"legal" has no intervalDays in the schedule, and its skill declares no default'],
        });
        expect(resolveCheckup({ name: "legal", intervalDays: 30 }, { defaults: null })).toEqual({
            kind: "invalid",
            errors: ['"legal" has no priority in the schedule, and its skill declares no default'],
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
        expect(isDue({ lastRun: null, intervalDays: 30 }, { today: "2026-09-29" })).toBe(true);
    });

    it("is due once the interval has passed", () => {
        expect(isDue({ lastRun: "2026-08-30", intervalDays: 30 }, { today: "2026-09-29" })).toBe(true);
    });

    it("is not due before the interval has passed", () => {
        expect(isDue({ lastRun: "2026-08-31", intervalDays: 30 }, { today: "2026-09-29" })).toBe(false);
    });

    it("refuses a malformed date", () => {
        expect(() => isDue({ lastRun: null, intervalDays: 30 }, { today: "yesterday" })).toThrow(/YYYY-MM-DD/);
    });
});

describe("skillSource", () => {
    const pluginSkills = new Set(["checkup-seo", "checkup-security"]);

    it("prefers the project's own version over the plugin's", () => {
        expect(skillSource("security", { projectSkills: new Set(["checkup-security"]), pluginSkills })).toBe("project");
    });

    it("falls back to the plugin's version", () => {
        expect(skillSource("seo", { projectSkills: new Set(), pluginSkills })).toBe("plugin");
    });

    it("finds nothing when neither has one", () => {
        expect(skillSource("backups", { projectSkills: new Set(), pluginSkills })).toBeNull();
    });
});

describe("checkupStatus", () => {
    it("takes the last run from the newest report, and keeps the skill source", () => {
        expect(
            checkupStatus(
                { ...legal, ...own },
                { reportFileNames: ["2026-09-27.md"], skill: "project", today: "2026-09-29" },
            ),
        ).toEqual({ ...legal, ...own, lastRun: "2026-09-27", due: false, skill: "project" });
    });
});

describe("buildReminder", () => {
    it("stays silent when nothing is due", () => {
        expect(buildReminder([status({ due: false })])).toBeNull();
    });

    it("asks Claude to offer overdue urgent checkups first", () => {
        const reminder = buildReminder([
            status({ ...legal, lastRun: "2026-08-01", due: true }),
            status({ ...seo, due: true }),
        ]);

        expect(reminder?.notice).toContain("- legal: last run 2026-08-01, due every 30 days");
        expect(reminder?.notice).toContain("Also due: seo.");
        expect(reminder?.context).toContain("offer to run the urgent checkups first");
    });

    it("only mentions other due checkups quietly", () => {
        const reminder = buildReminder([status({ ...seo, due: true })]);

        expect(reminder?.notice).toBe("Checkups due: seo. Run /factory:checkup when convenient.");
        expect(reminder?.context).toContain("Don't bring it up unless the user asks");
    });
});

describe("buildReminder with quiet checkups", () => {
    it("leaves due quiet checkups out of the session-start reminder", () => {
        expect(buildReminder([status({ due: true, priority: "quiet" })])).toBeNull();
    });

    it("still mentions the other due checkups", () => {
        const reminder = buildReminder([status({ due: true, priority: "quiet" }), status({ ...legal, due: true })]);

        expect(reminder?.notice).toStartWith("Urgent checkups are overdue:\n- legal");
        expect(reminder?.notice).not.toContain("seo");
    });
});

describe("buildReminder without skills", () => {
    it("mentions scheduled checkups that have no skill, and doesn't count them as due", () => {
        const reminder = buildReminder([status({ ...legal, due: true, skill: null })]);

        expect(reminder?.notice).toBe("No skill found for: legal; see /factory:checkup.");
        expect(reminder?.context).not.toContain("offer to run");
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
                declined: [],
            },
            { today: "2026-09-29" },
        );

        expect(report).toContain("| legal | urgent | 30 days | 2026-09-27 |  | plugin |");
        expect(report).toContain("| seo | normal | 60 days | never | **due** | plugin |");
    });

    it("marks the values the schedule sets itself, and explains the mark", () => {
        const report = statusReport(
            { kind: "scheduled", declined: [], statuses: [status({ intervalDays: 14, hasOwnInterval: true })] },
            { today: "2026-09-29" },
        );

        expect(report).toContain("| seo | normal | 14 days (own) | never |  | plugin |");
        expect(report).toContain("Values marked (own) are set in the schedule; the others are the checkup's defaults.");
    });

    it("marks checkups without a skill", () => {
        const report = statusReport(
            { kind: "scheduled", declined: [], statuses: [status({ skill: null })] },
            { today: "2026-09-29" },
        );

        expect(report).toContain("| seo | normal | 60 days | never |  | **missing** |");
    });

    it("lists declined checkups below the table", () => {
        const report = statusReport(
            { kind: "scheduled", statuses: [status({})], declined: ["monitoring"] },
            { today: "2026-09-29" },
        );

        expect(report).toEndWith("\n\nDeclined (not suggested again): monitoring");
    });

    it("explains when nothing is scheduled", () => {
        expect(statusReport({ kind: "unscheduled" }, { today: "2026-09-29" })).toContain("does not exist");
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

    const createProject = async (
        checkups: readonly ScheduleEntry[],
        reports: Record<string, string[]>,
    ): Promise<void> => {
        projectDir = await mkdtemp(path.join(tmpdir(), "checkups-"));
        await Bun.write(path.join(projectDir, "docs/checkups/checkups.json"), JSON.stringify({ checkups }));

        // Each scheduled checkup gets a project skill, so the tests don't depend on which skills the plugin ships.
        await Promise.all(
            checkups.map((checkup) =>
                Bun.write(path.join(projectDir, `.claude/skills/checkup-${checkup.name}/SKILL.md`), ""),
            ),
        );

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

    it("reminds about an overdue urgent checkup at session start", async () => {
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

        expect(await run("status")).toContain("| legal | urgent (own) | 30 days (own) | never | **due** | project |");
    });

    it("warns about a scheduled checkup that has no skill anywhere", async () => {
        await createProject([], {});
        await Bun.write(
            path.join(projectDir, "docs/checkups/checkups.json"),
            JSON.stringify({ checkups: [{ name: "no-such-checkup", intervalDays: 30, priority: "normal" }] }),
        );

        expect(JSON.parse(await run("reminder")).systemMessage).toBe(
            "No skill found for: no-such-checkup; see /factory:checkup.",
        );
    });

    it("fills in the defaults of the project's own skill, and marks the schedule's own values", async () => {
        await createProject([{ name: "legal" }, { name: "seo", intervalDays: 14 }], {});
        const skill = "---\nname: checkup-x\nmetadata:\n  intervalDays: 90\n  priority: quiet\n---\n";
        await Bun.write(path.join(projectDir, ".claude/skills/checkup-legal/SKILL.md"), skill);
        await Bun.write(path.join(projectDir, ".claude/skills/checkup-seo/SKILL.md"), skill);

        const status = await run("status");

        expect(status).toContain("| legal | quiet | 90 days | never | **due** | project |");
        expect(status).toContain("| seo | quiet | 14 days (own) | never | **due** | project |");
    });

    it("falls back to the plugin's defaults when the project's override declares none", async () => {
        await createProject([{ name: "security" }], {});

        expect(await run("status")).toContain("| security | urgent | 30 days | never | **due** | project |");
    });

    it("reports a checkup without values in the schedule or defaults in its skill", async () => {
        await createProject([{ name: "legal" }], {});

        expect(await run("status")).toContain(
            '- "legal" has no intervalDays in the schedule, and its skill declares no default',
        );
    });
});

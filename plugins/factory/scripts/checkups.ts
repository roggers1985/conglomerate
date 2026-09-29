// Recurring checkups (ADR 0010): works out which checkups are due in a project.
//
//   bun checkups.ts reminder [projectDir]   SessionStart hook output; prints nothing when nothing is due
//   bun checkups.ts status [projectDir]     markdown status table, injected into the /factory:checkup runner
//
// The schedule (docs/checkups/checkups.json) holds settings only. The last run of a checkup is the
// date of its newest report (docs/checkups/<name>/YYYY-MM-DD.md).

import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { assert } from "../../../lib/assert.ts";
import { isFileNotFound } from "../../../lib/errors.ts";
import { readJson } from "../../../lib/files.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";
import type { Parsed } from "../../../lib/parse.ts";
import { parse } from "../../../lib/parse.ts";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const CheckupConfigSchema = z.strictObject({
    name: z.string().regex(KEBAB_CASE, "must be kebab-case"),
    intervalDays: z.number().int().positive(),
    priority: z.boolean(),
});

// Our own file, so strict: unknown keys are typos (ADR 0020).
const ScheduleSchema = z
    .strictObject({ checkups: z.array(CheckupConfigSchema) })
    .superRefine(({ checkups }, context) => {
        const names = checkups.map((checkup) => checkup.name);
        const duplicates = new Set(names.filter((name, index) => names.indexOf(name) !== index));

        for (const name of duplicates) {
            context.addIssue({ code: "custom", message: `"${name}" is listed more than once`, path: ["checkups"] });
        }
    });

/** One entry of a project's checkup schedule (`docs/checkups/checkups.json`): settings only, no state. */
export type CheckupConfig = Readonly<z.infer<typeof CheckupConfigSchema>>;

/** A scheduled checkup with its last run (the date of its newest report) and whether it is due. */
export type CheckupStatus = CheckupConfig & {
    readonly lastRun: string | null;
    readonly due: boolean;
};

/** The outcome of validating a schedule: its checkups in order, or every problem found. */
export type ParsedSchedule = Parsed<readonly CheckupConfig[]>;

/** A project's checkups: none scheduled, an invalid schedule, or the status of every scheduled checkup. */
export type ProjectCheckups =
    | { readonly kind: "unscheduled" }
    | { readonly kind: "invalid"; readonly errors: readonly string[] }
    | { readonly kind: "scheduled"; readonly statuses: readonly CheckupStatus[] };

/** A session-start reminder: a short notice for the user, and instructions for Claude. */
export type Reminder = {
    readonly notice: string;
    readonly context: string;
};

/** The JSON a SessionStart hook prints: `systemMessage` is shown to the user, `additionalContext` goes to Claude. */
export type ReminderOutput = {
    readonly systemMessage: string;
    readonly hookSpecificOutput: {
        readonly hookEventName: "SessionStart";
        readonly additionalContext: string;
    };
};

const SCHEDULE_PATH = "docs/checkups/checkups.json";
const REPORTS_DIR = "docs/checkups";
const RUNNER = "/factory:checkup";

const REPORT_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parses the contents of a project's `docs/checkups/checkups.json`.
 *
 * @remarks
 * Strict: unknown fields are rejected, because they are almost always typos. Schedules from before ADR 0010 (like the
 * jobs project's, with `lastRun` and `summary`) must drop those fields.
 *
 * @param value - The parsed JSON, not yet trusted.
 * @returns The checkups in schedule order, or every problem found (invalid fields, duplicate names).
 *
 * @example
 * ```ts
 * const legal = { name: "legal", intervalDays: 30, priority: true };
 *
 * expect(parseSchedule({ checkups: [legal] })).toEqual({ kind: "valid", value: [legal] });
 * ```
 *
 * @example
 * ```ts
 * expect(parseSchedule({ checkups: [{ name: "Legal", intervalDays: 30, priority: true }] })).toEqual({
 *     kind: "invalid",
 *     errors: ["checkups[0].name: must be kebab-case"],
 * });
 * ```
 */
export function parseSchedule(value: unknown): ParsedSchedule {
    const parsed = parse(ScheduleSchema, value);

    if (parsed.kind === "invalid") {
        return parsed;
    }

    return { kind: "valid", value: parsed.value.checkups };
}

/**
 * Finds the date of the newest report among a checkup's report files.
 *
 * @param fileNames - File names in `docs/checkups/<name>/`; anything not named `YYYY-MM-DD.md` is ignored.
 * @returns The newest date as `YYYY-MM-DD`, or `null` when there is no report yet.
 *
 * @example
 * ```ts
 * expect(latestReportDate(["2026-08-01.md", "2026-09-27.md", "notes.md"])).toBe("2026-09-27");
 * expect(latestReportDate([])).toBeNull();
 * ```
 */
export function latestReportDate(fileNames: readonly string[]): string | null {
    const dates = fileNames.flatMap((fileName) => REPORT_FILE.exec(fileName)?.[1] ?? []);

    return dates.toSorted().at(-1) ?? null;
}

/**
 * Decides whether a checkup is due.
 *
 * @param schedule.lastRun - The date of its newest report as `YYYY-MM-DD`, or `null` when it never ran.
 * @param schedule.intervalDays - How often it should run.
 * @param options.today - Today's date as `YYYY-MM-DD`.
 * @returns `true` when it never ran, or when at least `intervalDays` have passed since `lastRun`.
 * @throws Error (an `assert` invariant) when `today` is not a valid date.
 *
 * @example
 * ```ts
 * const today = "2026-09-29";
 *
 * expect(isDue({ lastRun: null, intervalDays: 30 }, { today })).toBe(true);
 * expect(isDue({ lastRun: "2026-08-30", intervalDays: 30 }, { today })).toBe(true);
 * expect(isDue({ lastRun: "2026-08-31", intervalDays: 30 }, { today })).toBe(false);
 * ```
 */
export function isDue(
    { lastRun, intervalDays }: Pick<CheckupStatus, "lastRun" | "intervalDays">,
    { today }: { readonly today: string },
): boolean {
    assert(!Number.isNaN(Date.parse(today)), `today must be a YYYY-MM-DD date, got "${today}"`);

    if (lastRun === null) {
        return true;
    }

    return Date.parse(today) - Date.parse(lastRun) >= intervalDays * DAY_MS;
}

/**
 * Combines a checkup's settings with its reports into its current status.
 *
 * @param checkup - The checkup's entry in the schedule.
 * @param reportFileNames - The file names in its report folder.
 * @param options.today - Today's date as `YYYY-MM-DD`.
 * @returns The settings plus `lastRun` and `due`.
 *
 * @example
 * ```ts
 * const legal = { name: "legal", intervalDays: 30, priority: true };
 * const status = checkupStatus(legal, ["2026-09-27.md"], { today: "2026-09-29" });
 *
 * expect(status).toEqual({ name: "legal", intervalDays: 30, priority: true, lastRun: "2026-09-27", due: false });
 * ```
 */
export function checkupStatus(
    checkup: CheckupConfig,
    reportFileNames: readonly string[],
    { today }: { readonly today: string },
): CheckupStatus {
    const lastRun = latestReportDate(reportFileNames);

    return { ...checkup, lastRun, due: isDue({ lastRun, intervalDays: checkup.intervalDays }, { today }) };
}

/**
 * Builds the session-start reminder for due checkups.
 *
 * @remarks
 * Overdue priority checkups get a firm notice, and Claude is told to offer them before other work. Other due
 * checkups get one quiet line, and Claude is told not to bring them up unless asked (ADR 0010).
 *
 * @param statuses - The status of every scheduled checkup.
 * @returns The reminder, or `null` when nothing is due.
 *
 * @example
 * ```ts
 * const seo = { name: "seo", intervalDays: 60, priority: false, lastRun: null, due: true };
 *
 * expect(buildReminder([seo])?.notice).toBe("Checkups due: seo. Run /factory:checkup when convenient.");
 * expect(buildReminder([{ ...seo, due: false }])).toBeNull();
 * ```
 *
 * @example
 * ```ts
 * const legal = { name: "legal", intervalDays: 30, priority: true, lastRun: null, due: true };
 *
 * expect(buildReminder([legal])?.context).toContain("offer to run the priority checkups first");
 * ```
 */
export function buildReminder(statuses: readonly CheckupStatus[]): Reminder | null {
    const due = statuses.filter((status) => status.due);

    if (due.length === 0) {
        return null;
    }

    const priority = due.filter((status) => status.priority);
    const others = due.filter((status) => !status.priority);
    const otherNames = others.map((status) => status.name).join(", ");
    const othersLine = others.length === 0 ? [] : [`Also due: ${otherNames}.`];

    if (priority.length === 0) {
        return {
            notice: `Checkups due: ${otherNames}. Run ${RUNNER} when convenient.`,
            context: `The user has been notified that these checkups are due: ${otherNames}. Don't bring it up unless the user asks.`,
        };
    }

    const priorityLines = priority.map(
        (status) => `- ${status.name}: last run ${status.lastRun ?? "never"}, due every ${status.intervalDays} days`,
    );

    return {
        notice: ["Priority checkups are overdue:", ...priorityLines, ...othersLine].join("\n"),
        context: [
            "Priority checkups are overdue:",
            ...priorityLines,
            ...othersLine,
            `Before starting other work, tell the user and offer to run the priority checkups first with ${RUNNER}. If they decline, continue with their request.`,
        ].join("\n"),
    };
}

/**
 * Turns a project's checkups into the SessionStart hook's JSON output.
 *
 * @param project - The project's checkups.
 * @returns The output to print, or `null` (print nothing) when there is no schedule or nothing is due.
 *
 * @example
 * ```ts
 * expect(reminderOutput({ kind: "unscheduled" })).toBeNull();
 * expect(reminderOutput({ kind: "invalid", errors: ["is not valid JSON"] })?.systemMessage).toBe(
 *     "Checkups: docs/checkups/checkups.json is invalid: is not valid JSON",
 * );
 * ```
 */
export function reminderOutput(project: ProjectCheckups): ReminderOutput | null {
    if (project.kind === "unscheduled") {
        return null;
    }

    const reminder =
        project.kind === "invalid"
            ? { notice: `Checkups: ${SCHEDULE_PATH} is invalid: ${project.errors.join("; ")}`, context: "" }
            : buildReminder(project.statuses);

    if (reminder === null) {
        return null;
    }

    return {
        systemMessage: reminder.notice,
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: reminder.context || reminder.notice,
        },
    };
}

/**
 * Renders the status table that the `/factory:checkup` runner shows.
 *
 * @param project - The project's checkups.
 * @param options.today - Today's date as `YYYY-MM-DD`.
 * @returns A markdown table with due checkups in bold, or an explanation when nothing is scheduled.
 *
 * @example
 * ```ts
 * const legal = { name: "legal", intervalDays: 30, priority: true, lastRun: null, due: true };
 *
 * expect(statusReport({ kind: "scheduled", statuses: [legal] }, { today: "2026-09-29" })).toContain(
 *     "| legal | yes | 30 days | never | **due** |",
 * );
 * ```
 */
export function statusReport(project: ProjectCheckups, { today }: { readonly today: string }): string {
    if (project.kind === "unscheduled") {
        return `No checkups are scheduled: ${SCHEDULE_PATH} does not exist.`;
    }

    if (project.kind === "invalid") {
        return [`${SCHEDULE_PATH} is invalid:`, ...project.errors.map((error) => `- ${error}`)].join("\n");
    }

    if (project.statuses.length === 0) {
        return `No checkups are scheduled: ${SCHEDULE_PATH} has an empty list.`;
    }

    const rows = project.statuses.map(
        (status) =>
            `| ${status.name} | ${status.priority ? "yes" : ""} | ${status.intervalDays} days | ${status.lastRun ?? "never"} | ${status.due ? "**due**" : ""} |`,
    );

    return [
        `Today: ${today}`,
        "",
        "| Checkup | Priority | Every | Last run | Due |",
        "| --- | --- | --- | --- | --- |",
        ...rows,
    ].join("\n");
}

/**
 * Formats a date as `YYYY-MM-DD` in local time, the way report files are named.
 *
 * @param date - The date to format.
 * @returns The local calendar date.
 *
 * @example
 * ```ts
 * expect(formatDate(new Date(2026, 8, 29, 23, 59))).toBe("2026-09-29");
 * ```
 */
export function formatDate(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function readReportFileNames(
    projectDir: string,
    { name, signal }: { readonly name: string; readonly signal: AbortSignal },
): Promise<string[]> {
    // readdir takes no signal: check before starting instead.
    signal.throwIfAborted();

    try {
        return await readdir(path.join(projectDir, REPORTS_DIR, name));
    } catch (error: unknown) {
        if (isFileNotFound(error)) {
            return [];
        }
        throw error;
    }
}

/** The schedule's parsed JSON, or `null` when the project has no schedule. */
async function readScheduleJson(projectDir: string, { signal }: { readonly signal: AbortSignal }): Promise<unknown> {
    try {
        return await readJson(path.join(projectDir, SCHEDULE_PATH), { signal });
    } catch (error: unknown) {
        if (isFileNotFound(error)) {
            return null;
        }
        throw error;
    }
}

async function readSchedule(
    projectDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<ParsedSchedule | null> {
    try {
        const json = await readScheduleJson(projectDir, { signal });

        return json === null ? null : parseSchedule(json);
    } catch (error: unknown) {
        if (error instanceof SyntaxError) {
            return { kind: "invalid", errors: ["is not valid JSON"] };
        }
        throw error;
    }
}

async function loadProjectCheckups(
    projectDir: string,
    { today, signal }: { readonly today: string; readonly signal: AbortSignal },
): Promise<ProjectCheckups> {
    const schedule = await readSchedule(projectDir, { signal });

    if (schedule === null) {
        return { kind: "unscheduled" };
    }

    if (schedule.kind === "invalid") {
        return schedule;
    }

    const statuses = await Promise.all(
        schedule.value.map(async (checkup) =>
            checkupStatus(checkup, await readReportFileNames(projectDir, { name: checkup.name, signal }), { today }),
        ),
    );

    return { kind: "scheduled", statuses };
}

const COMMANDS = ["reminder", "status"] as const;

type Command = (typeof COMMANDS)[number];

const isCommand = (value: string | undefined): value is Command => COMMANDS.some((command) => command === value);

async function main(): Promise<void> {
    const [command, projectDirArgument] = Bun.argv.slice(2);

    if (!isCommand(command)) {
        console.error(`Usage: checkups.ts <${COMMANDS.join("|")}> [projectDir]`);
        process.exitCode = 1;
        return;
    }

    const projectDir =
        [projectDirArgument, process.env["CLAUDE_PROJECT_DIR"]].find((dir) => dir !== undefined && dir.length > 0) ??
        process.cwd();
    const today = formatDate(new Date());
    const project = await loadProjectCheckups(projectDir, { today, signal: interruptSignal() });

    if (command === "status") {
        console.log(statusReport(project, { today }));
        return;
    }

    const output = reminderOutput(project);

    if (output !== null) {
        console.log(JSON.stringify(output));
    }
}

if (import.meta.main) {
    await main();
}

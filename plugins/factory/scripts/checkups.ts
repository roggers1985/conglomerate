// Recurring checkups (ADR 0010): works out which checkups are due in a project.
//
//   bun checkups.ts reminder [projectDir]   SessionStart hook output; prints nothing when nothing is due
//   bun checkups.ts status [projectDir]     markdown status table, injected into the /factory:checkup runner
//
// The schedule (docs/checkups/checkups.json) holds settings only. The last run of a checkup is the
// date of its newest report (docs/checkups/<name>/YYYY-MM-DD.md).

import { readdir } from "node:fs/promises";
import path from "node:path";

export type CheckupConfig = {
    readonly name: string;
    readonly intervalDays: number;
    readonly priority: boolean;
};

export type CheckupStatus = CheckupConfig & {
    readonly lastRun: string | null;
    readonly due: boolean;
};

export type ParsedSchedule =
    | { readonly kind: "valid"; readonly checkups: readonly CheckupConfig[] }
    | { readonly kind: "invalid"; readonly errors: readonly string[] };

export type ProjectCheckups =
    | { readonly kind: "unscheduled" }
    | { readonly kind: "invalid"; readonly errors: readonly string[] }
    | { readonly kind: "scheduled"; readonly statuses: readonly CheckupStatus[] };

export type Reminder = {
    readonly notice: string;
    readonly context: string;
};

export type ReminderOutput = {
    readonly systemMessage: string;
    readonly hookSpecificOutput: {
        readonly hookEventName: "SessionStart";
        readonly additionalContext: string;
    };
};

// The shape of T before validation: every field may be missing and has an unknown value.
type Unvalidated<T> = { readonly [K in keyof T]?: unknown };

type Rule = readonly [passes: boolean, message: string];

export const SCHEDULE_PATH = "docs/checkups/checkups.json";
export const REPORTS_DIR = "docs/checkups";
export const RUNNER = "/factory:checkup";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const REPORT_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

const isObject = <T>(value: unknown): value is Unvalidated<T> => typeof value === "object" && value !== null;

const failedRules = (rules: readonly Rule[]): string[] =>
    rules.filter(([passes]) => !passes).map(([, message]) => message);

function validateEntry(entry: unknown, index: number): string[] {
    if (!isObject<CheckupConfig>(entry)) {
        return [`checkups[${index}] must be an object`];
    }

    const { name, intervalDays, priority } = entry;

    return failedRules([
        [typeof name === "string" && KEBAB_CASE.test(name), `checkups[${index}].name must be kebab-case`],
        [
            typeof intervalDays === "number" && Number.isInteger(intervalDays) && intervalDays > 0,
            `checkups[${index}].intervalDays must be a positive whole number`,
        ],
        [typeof priority === "boolean", `checkups[${index}].priority must be true or false`],
    ]);
}

const isCheckupConfig = (entry: unknown): entry is CheckupConfig => validateEntry(entry, 0).length === 0;

function duplicateNames(entries: readonly unknown[]): string[] {
    const names = entries.flatMap((entry) =>
        isObject<CheckupConfig>(entry) && typeof entry.name === "string" ? [entry.name] : [],
    );

    return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

export function parseSchedule(value: unknown): ParsedSchedule {
    if (!isObject<{ checkups: unknown }>(value) || !Array.isArray(value.checkups)) {
        return { kind: "invalid", errors: ['must be an object with a "checkups" array'] };
    }

    const entries: readonly unknown[] = value.checkups;
    const errors = [
        ...entries.flatMap(validateEntry),
        ...duplicateNames(entries).map((name) => `checkup "${name}" is listed more than once`),
    ];

    if (errors.length > 0) {
        return { kind: "invalid", errors };
    }

    return { kind: "valid", checkups: entries.filter(isCheckupConfig) };
}

export function latestReportDate(fileNames: readonly string[]): string | null {
    const dates = fileNames.flatMap((fileName) => REPORT_FILE.exec(fileName)?.[1] ?? []);

    return dates.toSorted().at(-1) ?? null;
}

/** Due when never run, or when at least `intervalDays` have passed since the last run. Dates are `YYYY-MM-DD`. */
export function isDue(lastRun: string | null, intervalDays: number, today: string): boolean {
    assert(!Number.isNaN(Date.parse(today)), `today must be a YYYY-MM-DD date, got "${today}"`);

    if (lastRun === null) {
        return true;
    }

    return Date.parse(today) - Date.parse(lastRun) >= intervalDays * DAY_MS;
}

export function checkupStatus(
    checkup: CheckupConfig,
    reportFileNames: readonly string[],
    today: string,
): CheckupStatus {
    const lastRun = latestReportDate(reportFileNames);

    return { ...checkup, lastRun, due: isDue(lastRun, checkup.intervalDays, today) };
}

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

export function statusReport(project: ProjectCheckups, today: string): string {
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

export function formatDate(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const isMissingFile = (error: unknown): boolean => error instanceof Error && "code" in error && error.code === "ENOENT";

async function readReportFileNames(projectDir: string, name: string): Promise<string[]> {
    try {
        return await readdir(path.join(projectDir, REPORTS_DIR, name));
    } catch (error: unknown) {
        if (isMissingFile(error)) {
            return [];
        }
        throw error;
    }
}

async function readSchedule(projectDir: string): Promise<ParsedSchedule | null> {
    const file = Bun.file(path.join(projectDir, SCHEDULE_PATH));

    if (!(await file.exists())) {
        return null;
    }

    try {
        return parseSchedule(await file.json());
    } catch {
        return { kind: "invalid", errors: ["is not valid JSON"] };
    }
}

export async function loadProjectCheckups(projectDir: string, today: string): Promise<ProjectCheckups> {
    const schedule = await readSchedule(projectDir);

    if (schedule === null) {
        return { kind: "unscheduled" };
    }

    if (schedule.kind === "invalid") {
        return schedule;
    }

    const statuses = await Promise.all(
        schedule.checkups.map(async (checkup) =>
            checkupStatus(checkup, await readReportFileNames(projectDir, checkup.name), today),
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
    const project = await loadProjectCheckups(projectDir, today);

    if (command === "status") {
        console.log(statusReport(project, today));
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

// Recurring checkups (ADR 0010): works out which checkups are due in a project.
//
//   bun checkups.ts reminder [projectDir]   SessionStart hook output; prints nothing when nothing is due
//   bun checkups.ts status [projectDir]     markdown status table, injected into the /factory:checkup runner
//
// The schedule (docs/checkups/checkups.json) holds settings only. The last run of a checkup is the
// date of its newest report (docs/checkups/<name>/YYYY-MM-DD.md).

import path from "node:path";
import { z } from "zod";
import { assert } from "../../../lib/assert.ts";
import {
    JSON_BYTES_MAX,
    readDir,
    readJson,
    readText,
    SymbolicLinkError,
    symbolicLinkMessage,
    TEXT_BYTES_MAX,
    whenMissing,
} from "../../../lib/files.ts";
import { parseFrontmatter } from "../../../lib/frontmatter.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";
import { KEBAB_CASE } from "../../../lib/kebab-case.ts";
import type { Parsed } from "../../../lib/parse.ts";
import { parse } from "../../../lib/parse.ts";
import { resolveProjectDir } from "./project-dir.ts";

/**
 * How insistently a due checkup is brought up at session start (ADR 0030): `urgent` checkups are offered before
 * other work, `normal` ones get one quiet line, and `quiet` ones only show in the `/factory:checkup` status.
 */
const PRIORITIES = ["urgent", "normal", "quiet"] as const;

/** How insistently a due checkup is brought up (ADR 0030). */
export type Priority = (typeof PRIORITIES)[number];

const CHECKUPS_MAX = 100; // more than any project needs; a longer list means something generated it wrongly
const NAME_LENGTH_MAX = 50; // the longest checkup name today has 20 characters
const INTERVAL_DAYS_MAX = 365; // every checkup runs at least once a year
const REPORTS_MAX = 10_000; // one checkup's reports: a daily one for more than 25 years
const SKILLS_MAX = 200; // a project's or the plugin's skills; each costs a line of Claude's context

const CheckupName = z.string().max(NAME_LENGTH_MAX).regex(KEBAB_CASE, "must be kebab-case");

const IntervalDays = z.number().int().min(1).max(INTERVAL_DAYS_MAX);

// Without `intervalDays` or `priority`, the checkup's skill supplies the default (ADR 0049).
const ScheduleEntrySchema = z.strictObject({
    name: CheckupName,
    intervalDays: IntervalDays.optional(),
    priority: z.enum(PRIORITIES).optional(),
});

// A skill's frontmatter is Claude Code's format, so extra keys are allowed (ADR 0020).
const CheckupDefaultsSchema = z.looseObject({
    metadata: z.looseObject({ intervalDays: IntervalDays, priority: z.enum(PRIORITIES) }),
});

// Our own file, so strict: unknown keys are typos (ADR 0020).
const ScheduleSchema = z
    .strictObject({
        checkups: z.array(ScheduleEntrySchema).max(CHECKUPS_MAX),
        /** Checkups the owner opted out of: the runner doesn't suggest them again (ADR 0037). */
        declined: z.array(CheckupName).max(CHECKUPS_MAX).optional(),
    })
    .superRefine(({ checkups, declined = [] }, context) => {
        const names = checkups.map((checkup) => checkup.name);
        const duplicates = new Set(names.filter((name, index) => names.indexOf(name) !== index));
        const scheduledAndDeclined = declined.filter((name) => names.includes(name));

        for (const name of duplicates) {
            context.addIssue({ code: "custom", message: `"${name}" is listed more than once`, path: ["checkups"] });
        }

        for (const name of scheduledAndDeclined) {
            context.addIssue({
                code: "custom",
                message: `"${name}" is both scheduled and declined`,
                path: ["declined"],
            });
        }
    });

/** One entry of a project's checkup schedule (`docs/checkups/checkups.json`), as written: only `name` is required. */
export type ScheduleEntry = Readonly<z.infer<typeof ScheduleEntrySchema>>;

/** The defaults a checkup's skill declares in its frontmatter (`metadata.intervalDays`, `metadata.priority`). */
export type CheckupDefaults = { readonly intervalDays: number; readonly priority: Priority };

/** A checkup's complete settings: its schedule entry, with the skill's defaults filled in. */
export type CheckupConfig = {
    readonly name: string;
    readonly intervalDays: number;
    readonly priority: Priority;
    /** `true` when the schedule sets the interval itself, instead of using the skill's default. */
    readonly hasOwnInterval: boolean;
    /** `true` when the schedule sets the priority itself, instead of using the skill's default. */
    readonly hasOwnPriority: boolean;
};

/** Where a checkup's skill comes from. A project's own `checkup-<name>` overrides the plugin's (ADR 0023). */
export type SkillSource = "project" | "plugin";

/** A scheduled checkup with its last run (the date of its newest report), whether it is due, and its skill. */
export type CheckupStatus = CheckupConfig & {
    readonly lastRun: string | null;
    readonly due: boolean;
    /** `null` when neither the project nor the plugin has a skill for it, so it can't run. */
    readonly skill: SkillSource | null;
};

/** A project's checkup schedule: what runs how often, and what the owner opted out of. */
export type Schedule = {
    readonly checkups: readonly ScheduleEntry[];
    /** Checkups the owner declined; empty when the schedule has no `declined` list. */
    readonly declined: readonly string[];
};

/** The outcome of parsing a schedule: the schedule, or every problem found. */
export type ParsedSchedule = Parsed<Schedule>;

/** A project's checkups: none scheduled, an invalid schedule, or the status of every scheduled checkup. */
export type ProjectCheckups =
    | { readonly kind: "unscheduled" }
    | { readonly kind: "invalid"; readonly errors: readonly string[] }
    | {
          readonly kind: "scheduled";
          readonly statuses: readonly CheckupStatus[];
          /** Checkups the owner declined (ADR 0037). */
          readonly declined: readonly string[];
      };

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

const PLUGIN_SKILLS_DIR = path.resolve(import.meta.dir, "..", "skills");
const PROJECT_SKILLS_DIR = ".claude/skills";

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
 * const legal = { name: "legal", intervalDays: 30, priority: "urgent" };
 *
 * expect(parseSchedule({ checkups: [legal] })).toEqual({ kind: "valid", value: { checkups: [legal], declined: [] } });
 * ```
 *
 * @example
 * ```ts
 * expect(parseSchedule({ checkups: [{ name: "Legal", intervalDays: 30, priority: "urgent" }] })).toEqual({
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

    return { kind: "valid", value: { checkups: parsed.value.checkups, declined: parsed.value.declined ?? [] } };
}

/**
 * Reads a checkup skill's defaults from its parsed frontmatter.
 *
 * @param frontmatter - The skill's parsed frontmatter, not yet trusted.
 * @returns The skill's default interval and priority, or every problem found.
 *
 * @example
 * ```ts
 * expect(parseCheckupDefaults({ name: "checkup-seo", metadata: { intervalDays: 60, priority: "normal" } })).toEqual({
 *     kind: "valid",
 *     value: { intervalDays: 60, priority: "normal" },
 * });
 * expect(parseCheckupDefaults({ name: "checkup-seo" }).kind).toBe("invalid");
 * ```
 */
export function parseCheckupDefaults(frontmatter: unknown): Parsed<CheckupDefaults> {
    const parsed = parse(CheckupDefaultsSchema, frontmatter);

    if (parsed.kind === "invalid") {
        return parsed;
    }

    const { intervalDays, priority } = parsed.value.metadata;

    return { kind: "valid", value: { intervalDays, priority } };
}

/**
 * Completes a schedule entry with its skill's defaults: a value in the schedule wins, the skill's default fills the gap
 * (ADR 0049).
 *
 * @param entry - The checkup's entry in the schedule.
 * @param options.defaults - The skill's defaults; `null` when the checkup has no skill, or its skill declares none.
 * @returns The complete settings, or the problem when a value is missing from both.
 *
 * @example
 * ```ts
 * const defaults = { intervalDays: 30, priority: "urgent" } as const;
 *
 * expect(resolveCheckup({ name: "security", intervalDays: 14 }, { defaults })).toEqual({
 *     kind: "valid",
 *     value: { name: "security", intervalDays: 14, priority: "urgent", hasOwnInterval: true, hasOwnPriority: false },
 * });
 * expect(resolveCheckup({ name: "legal" }, { defaults: null }).kind).toBe("invalid");
 * ```
 */
export function resolveCheckup(
    entry: ScheduleEntry,
    { defaults }: { readonly defaults: CheckupDefaults | null },
): Parsed<CheckupConfig> {
    const intervalDays = entry.intervalDays ?? defaults?.intervalDays;
    const priority = entry.priority ?? defaults?.priority;
    const noDefault = "and its skill declares no default";

    if (intervalDays === undefined) {
        return { kind: "invalid", errors: [`"${entry.name}" has no intervalDays in the schedule, ${noDefault}`] };
    }

    if (priority === undefined) {
        return { kind: "invalid", errors: [`"${entry.name}" has no priority in the schedule, ${noDefault}`] };
    }

    return {
        kind: "valid",
        value: {
            name: entry.name,
            intervalDays,
            priority,
            hasOwnInterval: entry.intervalDays !== undefined,
            hasOwnPriority: entry.priority !== undefined,
        },
    };
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
 * Finds the skill that runs a checkup.
 *
 * @param name - The checkup's name; its skill is called `checkup-<name>`.
 * @param options.projectSkills - Skill names in the project's `.claude/skills/`.
 * @param options.pluginSkills - Skill names in the plugin's `skills/`.
 * @returns `"project"` when the project has its own version (it overrides the plugin's), `"plugin"` when only the
 * plugin has one, and `null` when neither does.
 *
 * @example
 * ```ts
 * const pluginSkills = new Set(["checkup-security", "checkup-seo"]);
 * const projectSkills = new Set(["checkup-legal", "checkup-security"]);
 *
 * expect(skillSource("security", { projectSkills, pluginSkills })).toBe("project");
 * expect(skillSource("seo", { projectSkills, pluginSkills })).toBe("plugin");
 * expect(skillSource("backups", { projectSkills, pluginSkills })).toBeNull();
 * ```
 */
export function skillSource(
    name: string,
    {
        projectSkills,
        pluginSkills,
    }: { readonly projectSkills: ReadonlySet<string>; readonly pluginSkills: ReadonlySet<string> },
): SkillSource | null {
    const skillName = `checkup-${name}`;

    if (projectSkills.has(skillName)) {
        return "project";
    }

    return pluginSkills.has(skillName) ? "plugin" : null;
}

/**
 * Combines a checkup's settings with its reports and skill into its current status.
 *
 * @param checkup - The checkup's entry in the schedule.
 * @param options.reportFileNames - The file names in its report folder.
 * @param options.skill - Where its skill comes from, from {@link skillSource}.
 * @param options.today - Today's date as `YYYY-MM-DD`.
 * @returns The settings plus `lastRun`, `due` and `skill`.
 *
 * @example
 * ```ts
 * const legal = { name: "legal", intervalDays: 30, priority: "urgent" };
 * const status = checkupStatus(legal, { reportFileNames: ["2026-09-27.md"], skill: "project", today: "2026-09-29" });
 *
 * expect(status).toEqual({ ...legal, lastRun: "2026-09-27", due: false, skill: "project" });
 * ```
 */
export function checkupStatus(
    checkup: CheckupConfig,
    {
        reportFileNames,
        skill,
        today,
    }: { readonly reportFileNames: readonly string[]; readonly skill: SkillSource | null; readonly today: string },
): CheckupStatus {
    const lastRun = latestReportDate(reportFileNames);

    return { ...checkup, lastRun, due: isDue({ lastRun, intervalDays: checkup.intervalDays }, { today }), skill };
}

/**
 * Builds the session-start reminder for due checkups.
 *
 * @remarks
 * Overdue `urgent` checkups get a firm notice, and Claude is told to offer them before other work. Due `normal`
 * checkups get one quiet line, and Claude is told not to bring them up unless asked. `quiet` checkups are left out
 * (ADR 0030). Scheduled checkups without a skill are always mentioned, since they can't run.
 *
 * @param statuses - The status of every scheduled checkup.
 * @returns The reminder, or `null` when nothing is due.
 *
 * @example
 * ```ts
 * const seo = { name: "seo", intervalDays: 60, priority: "normal", lastRun: null, due: true, skill: "plugin" } as const;
 *
 * expect(buildReminder([seo])?.notice).toBe("Checkups due: seo. Run /factory:checkup when convenient.");
 * expect(buildReminder([{ ...seo, due: false }])).toBeNull();
 * ```
 *
 * @example
 * ```ts
 * const legal = { name: "legal", intervalDays: 30, priority: "urgent", lastRun: null, due: true, skill: "project" } as const;
 *
 * expect(buildReminder([legal])?.context).toContain("offer to run the urgent checkups first");
 * expect(buildReminder([{ ...legal, priority: "quiet" }])).toBeNull();
 * expect(buildReminder([{ ...legal, skill: null }])?.notice).toBe("No skill found for: legal; see /factory:checkup.");
 * ```
 */
export function buildReminder(statuses: readonly CheckupStatus[]): Reminder | null {
    const withoutSkill = statuses.filter((status) => status.skill === null).map((status) => status.name);
    const due = statuses
        .filter((status) => status.skill !== null)
        .filter((status) => status.due)
        .filter((status) => status.priority !== "quiet");
    const hasNothingToSay = due.length === 0 && withoutSkill.length === 0;

    if (hasNothingToSay) {
        return null;
    }

    const urgent = due.filter((status) => status.priority === "urgent");
    const others = due.filter((status) => status.priority === "normal");
    const urgentBlock =
        urgent.length === 0
            ? []
            : [
                  "Urgent checkups are overdue:",
                  ...urgent.map(
                      (status) =>
                          `- ${status.name}: last run ${status.lastRun ?? "never"}, due every ${status.intervalDays} days`,
                  ),
              ];
    const notice = [
        ...urgentBlock,
        ...otherDueLine(others, { afterUrgent: urgent.length > 0 }),
        ...(withoutSkill.length === 0 ? [] : [`No skill found for: ${withoutSkill.join(", ")}; see ${RUNNER}.`]),
    ].join("\n");
    const instruction =
        urgent.length === 0
            ? "The user has been notified of the above. Don't bring it up unless the user asks."
            : `Before starting other work, tell the user and offer to run the urgent checkups first with ${RUNNER}. If they decline, continue with their request.`;

    return { notice, context: `${notice}\n${instruction}` };
}

function otherDueLine(others: readonly CheckupStatus[], { afterUrgent }: { readonly afterUrgent: boolean }): string[] {
    const names = others.map((status) => status.name).join(", ");

    if (others.length === 0) {
        return [];
    }

    if (afterUrgent) {
        return [`Also due: ${names}.`];
    }

    return [`Checkups due: ${names}. Run ${RUNNER} when convenient.`];
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
 * expect(reminderOutput({ kind: "invalid", errors: ["docs/checkups/checkups.json is not valid JSON"] })?.systemMessage).toBe(
 *     "Checkups are invalid: docs/checkups/checkups.json is not valid JSON",
 * );
 * ```
 */
export function reminderOutput(project: ProjectCheckups): ReminderOutput | null {
    if (project.kind === "unscheduled") {
        return null;
    }

    const reminder =
        project.kind === "invalid"
            ? { notice: `Checkups are invalid: ${project.errors.join("; ")}`, context: "" }
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

const ownMark = (isOwn: boolean): string => (isOwn ? " (own)" : "");

/**
 * Renders the status table that the `/factory:checkup` runner shows.
 *
 * @param project - The project's checkups.
 * @param options.today - Today's date as `YYYY-MM-DD`.
 * @returns A markdown table with due checkups and missing skills in bold, or an explanation when nothing is scheduled.
 *
 * @example
 * ```ts
 * const legal = { name: "legal", intervalDays: 30, priority: "urgent", lastRun: null, due: true, skill: "project" } as const;
 *
 * expect(statusReport({ kind: "scheduled", statuses: [legal], declined: [] }, { today: "2026-09-29" })).toContain(
 *     "| legal | urgent | 30 days | never | **due** | project |",
 * );
 * ```
 */
export function statusReport(project: ProjectCheckups, { today }: { readonly today: string }): string {
    if (project.kind === "unscheduled") {
        return `No checkups are scheduled: ${SCHEDULE_PATH} does not exist.`;
    }

    if (project.kind === "invalid") {
        return ["Checkups are invalid:", ...project.errors.map((error) => `- ${error}`)].join("\n");
    }

    const declinedLine =
        project.declined.length === 0 ? [] : ["", `Declined (not suggested again): ${project.declined.join(", ")}`];

    if (project.statuses.length === 0) {
        return [`No checkups are scheduled: ${SCHEDULE_PATH} has an empty list.`, ...declinedLine].join("\n");
    }

    const rows = project.statuses.map(
        (status) =>
            `| ${status.name} | ${status.priority}${ownMark(status.hasOwnPriority)} | ${status.intervalDays} days${ownMark(status.hasOwnInterval)} | ${status.lastRun ?? "never"} | ${status.due ? "**due**" : ""} | ${status.skill ?? "**missing**"} |`,
    );

    return [
        `Today: ${today}`,
        "",
        "| Checkup | Priority | Every | Last run | Due | Skill |",
        "| --- | --- | --- | --- | --- | --- |",
        ...rows,
        "",
        "Values marked (own) are set in the schedule; the others are the checkup's defaults.",
        ...declinedLine,
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
    const dir = path.join(projectDir, REPORTS_DIR, name);
    const entries = await readDir(dir, { maxEntries: REPORTS_MAX, signal }).catch(whenMissing([]));

    return entries.map((entry) => entry.name);
}

/** The names of the skills in a folder; empty when the folder doesn't exist. */
async function skillNames(dir: string, { signal }: { readonly signal: AbortSignal }): Promise<ReadonlySet<string>> {
    const entries = await readDir(dir, { maxEntries: SKILLS_MAX, signal }).catch(whenMissing([]));

    return new Set(entries.map((entry) => entry.name));
}

/** The schedule's parsed JSON, or `null` when the project has no schedule. */
function readScheduleJson(projectDir: string, { signal }: { readonly signal: AbortSignal }): Promise<unknown> {
    const schedulePath = path.join(projectDir, SCHEDULE_PATH);

    return readJson(schedulePath, { maxBytes: JSON_BYTES_MAX, signal, symbolicLinks: "refuse" }).catch(
        whenMissing(null),
    );
}

/** What reading a skill's defaults found: the defaults (`null` when there are none), or why the file can't be used. */
type SkillDefaults =
    | { readonly kind: "read"; readonly defaults: CheckupDefaults | null }
    | { readonly kind: "invalid"; readonly errors: readonly string[] };

/** A skill's checkup defaults; `defaults` is `null` when the skill doesn't exist, or its frontmatter declares no valid ones. */
async function readSkillDefaults(
    skillFile: string,
    {
        displayPath,
        signal,
        symbolicLinks,
    }: { readonly displayPath: string; readonly signal: AbortSignal; readonly symbolicLinks: "follow" | "refuse" },
): Promise<SkillDefaults> {
    try {
        const markdown = await readText(skillFile, { maxBytes: TEXT_BYTES_MAX, signal, symbolicLinks }).catch(
            whenMissing(null),
        );

        if (markdown === null) {
            return { kind: "read", defaults: null };
        }

        const defaults = parseCheckupDefaults(parseFrontmatter(markdown));

        return { kind: "read", defaults: defaults.kind === "valid" ? defaults.value : null };
    } catch (error: unknown) {
        // Invalid YAML means no usable defaults; `resolveCheckup` then reports the checkup, and validate the skill.
        if (error instanceof SyntaxError) {
            return { kind: "read", defaults: null };
        }
        if (error instanceof SymbolicLinkError) {
            return { kind: "invalid", errors: [symbolicLinkMessage(displayPath)] };
        }
        throw error;
    }
}

/**
 * A checkup's defaults: from the project's own skill when it has one that declares them, else from the plugin's. A
 * project skill that is a symbolic link makes the checkup invalid, and the plugin's defaults are then not used.
 */
async function readCheckupDefaults(
    projectDir: string,
    { name, signal }: { readonly name: string; readonly signal: AbortSignal },
): Promise<SkillDefaults> {
    const skillDir = `checkup-${name}`;
    const projectSkill = path.join(PROJECT_SKILLS_DIR, skillDir, "SKILL.md");
    const [project, plugin] = await Promise.all([
        readSkillDefaults(path.join(projectDir, projectSkill), {
            displayPath: projectSkill,
            signal,
            symbolicLinks: "refuse",
        }),
        readSkillDefaults(path.join(PLUGIN_SKILLS_DIR, skillDir, "SKILL.md"), {
            displayPath: path.join(skillDir, "SKILL.md"),
            signal,
            symbolicLinks: "follow",
        }),
    ]);

    if (project.kind === "invalid") {
        return project;
    }

    return project.defaults === null ? plugin : project;
}

/** The schedule's own problems, each starting with the file's path, so every line of a report names its file. */
function prefixErrors<Value>(parsed: Parsed<Value>): Parsed<Value> {
    return parsed.kind === "valid"
        ? parsed
        : { kind: "invalid", errors: parsed.errors.map((error) => `${SCHEDULE_PATH}: ${error}`) };
}

async function readSchedule(
    projectDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<ParsedSchedule | null> {
    try {
        const json = await readScheduleJson(projectDir, { signal });

        return json === null ? null : prefixErrors(parseSchedule(json));
    } catch (error: unknown) {
        if (error instanceof SyntaxError) {
            return { kind: "invalid", errors: [`${SCHEDULE_PATH} is not valid JSON`] };
        }
        if (error instanceof SymbolicLinkError) {
            return { kind: "invalid", errors: [symbolicLinkMessage(SCHEDULE_PATH)] };
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

    const resolved = await Promise.all(
        schedule.value.checkups.map(async (entry) => {
            const skillDefaults = await readCheckupDefaults(projectDir, { name: entry.name, signal });

            return skillDefaults.kind === "invalid"
                ? skillDefaults
                : prefixErrors(resolveCheckup(entry, { defaults: skillDefaults.defaults }));
        }),
    );
    const errors = resolved.flatMap((result) => (result.kind === "invalid" ? result.errors : []));

    if (errors.length > 0) {
        return { kind: "invalid", errors };
    }

    const checkups = resolved.flatMap((result) => (result.kind === "valid" ? [result.value] : []));
    const [projectSkills, pluginSkills] = await Promise.all([
        skillNames(path.join(projectDir, PROJECT_SKILLS_DIR), { signal }),
        skillNames(PLUGIN_SKILLS_DIR, { signal }),
    ]);
    const statuses = await Promise.all(
        checkups.map(async (checkup) =>
            checkupStatus(checkup, {
                reportFileNames: await readReportFileNames(projectDir, { name: checkup.name, signal }),
                skill: skillSource(checkup.name, { projectSkills, pluginSkills }),
                today,
            }),
        ),
    );

    return { kind: "scheduled", statuses, declined: schedule.value.declined };
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

    const projectDir = resolveProjectDir({
        argument: projectDirArgument,
        envProjectDir: process.env["CLAUDE_PROJECT_DIR"],
        cwd: process.cwd(),
    });
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

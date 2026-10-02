// Project settings (ADR 0044, 0058): `.claude/factory.json` sets a project's autonomy level and its tuning values.
// Every value has a visible default and bounds; the rules that make up the plugin's character aren't settings.

import path from "node:path";
import { z } from "zod";
import { JSON_BYTES_MAX, readJson, whenMissing } from "../../../lib/files.ts";
import type { Parsed } from "../../../lib/parse.ts";
import { parse } from "../../../lib/parse.ts";

/** The autonomy levels, from least to most: who decides what (ADR 0044). */
export const AUTONOMY_LEVELS = ["guided", "trusted", "autonomous"] as const;

/** One autonomy level. */
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

/** The level when a project sets none: the owner decides, Claude proposes. */
export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = "guided";

/** The generated JSON Schema of the settings file, relative to the plugin's folder (ADR 0058). */
export const SETTINGS_SCHEMA_FILE = "schemas/factory.schema.json";

/** Where a project keeps its factory settings, relative to the project folder. */
export const FACTORY_SETTINGS_PATH = ".claude/factory.json";

/**
 * The tuning values a project may set, each with its default, its bounds and what it limits. These are knobs, not
 * rules: what is always the owner's, and the stages' gates, can't be configured (ADR 0058).
 */
export const LIMITS = {
    reviewRounds: { default: 3, min: 1, max: 10, use: "review rounds per change before open findings go to the owner" },
    parallelTasks: { default: 3, min: 1, max: 10, use: "build tasks that may run at the same time" },
    attemptsPerTask: {
        default: 3,
        min: 1,
        max: 10,
        use: "attempts at the same task or failing check before escalating",
    },
    subagentsPerChange: { default: 10, min: 1, max: 50, use: "subagents per change at the autonomous level" },
} as const;

/** The name of one tuning value. */
export type LimitName = keyof typeof LIMITS;

/** Every tuning value, resolved: the project's own, or the default. */
export type Limits = Readonly<Record<LimitName, number>>;

const LIMIT_NAMES = Object.keys(LIMITS).filter((name): name is LimitName => name in LIMITS);

const limitSchema = (name: LimitName) =>
    z.number().int().min(LIMITS[name].min).max(LIMITS[name].max).describe(LIMITS[name].use);

// Our own file, so strict: unknown keys are typos (ADR 0020). `$schema` lets an editor validate and complete it.
const FactorySettingsSchema = z
    .strictObject({
        $schema: z.string().max(500).optional(),
        autonomy: z.enum(AUTONOMY_LEVELS).optional().describe("How much Claude decides without asking (ADR 0044)"),
        limits: z
            .strictObject({
                reviewRounds: limitSchema("reviewRounds").optional(),
                parallelTasks: limitSchema("parallelTasks").optional(),
                attemptsPerTask: limitSchema("attemptsPerTask").optional(),
                subagentsPerChange: limitSchema("subagentsPerChange").optional(),
            })
            .optional(),
    })
    .superRefine(({ limits = {} }, context) => {
        // Related limits are checked against each other once (code-safety): parallel tasks each need a subagent.
        const parallelTasks = limits.parallelTasks ?? LIMITS.parallelTasks.default;
        const subagentsPerChange = limits.subagentsPerChange ?? LIMITS.subagentsPerChange.default;

        if (parallelTasks > subagentsPerChange) {
            context.addIssue({
                code: "custom",
                message: `parallelTasks (${parallelTasks}) can't exceed subagentsPerChange (${subagentsPerChange})`,
                path: ["limits", "parallelTasks"],
            });
        }
    });

/** A project's settings, complete: what it sets itself, with the defaults filled in. */
export type FactorySettings = {
    readonly autonomy: AutonomyLevel;
    readonly limits: Limits;
    /** The values the project sets itself, so the session context can tell them from the defaults. */
    readonly own: ReadonlySet<"autonomy" | LimitName>;
};

/** A project's settings: from its file, the defaults when it has none, or the defaults with the errors of an invalid file. */
export type ProjectSettings =
    | { readonly kind: "project" | "default"; readonly settings: FactorySettings }
    | { readonly kind: "invalid"; readonly settings: FactorySettings; readonly errors: readonly string[] };

/** The settings when a project sets nothing. */
export const DEFAULT_SETTINGS: FactorySettings = {
    autonomy: DEFAULT_AUTONOMY_LEVEL,
    limits: {
        reviewRounds: LIMITS.reviewRounds.default,
        parallelTasks: LIMITS.parallelTasks.default,
        attemptsPerTask: LIMITS.attemptsPerTask.default,
        subagentsPerChange: LIMITS.subagentsPerChange.default,
    },
    own: new Set(),
};

/**
 * Parses the contents of `.claude/factory.json`, and fills in the defaults for what it leaves out.
 *
 * @param value - The parsed JSON, not yet trusted.
 * @returns The complete settings, or every problem found.
 *
 * @example
 * ```ts
 * const parsed = parseFactorySettings({ autonomy: "trusted", limits: { reviewRounds: 5 } });
 *
 * expect(parsed.kind === "valid" && parsed.value.limits).toEqual({
 *     reviewRounds: 5, parallelTasks: 3, attemptsPerTask: 3, subagentsPerChange: 10,
 * });
 * expect(parseFactorySettings({ limits: { reviewRounds: 11 } }).kind).toBe("invalid");
 * ```
 */
export function parseFactorySettings(value: unknown): Parsed<FactorySettings> {
    const parsed = parse(FactorySettingsSchema, value);

    if (parsed.kind === "invalid") {
        return parsed;
    }

    const { autonomy, limits = {} } = parsed.value;
    const ownLimits = LIMIT_NAMES.filter((name) => limits[name] !== undefined);
    const resolved = Object.fromEntries(
        LIMIT_NAMES.map((name) => [name, limits[name] ?? DEFAULT_SETTINGS.limits[name]]),
    );

    return {
        kind: "valid",
        value: {
            autonomy: autonomy ?? DEFAULT_SETTINGS.autonomy,
            limits: { ...DEFAULT_SETTINGS.limits, ...resolved },
            own: new Set([...(autonomy === undefined ? [] : (["autonomy"] as const)), ...ownLimits]),
        },
    };
}

/**
 * Reads a project's settings from `.claude/factory.json`.
 *
 * @remarks
 * A missing file means the defaults. An invalid file falls back to the defaults too, the most careful level among
 * them, and says why, so a typo never grants more autonomy than intended (fail safe, ADR 0048).
 *
 * @param projectDir - The project folder.
 * @param options.signal - Cancels the read.
 * @returns The project's settings, the defaults, or the defaults with the errors of an invalid file.
 * @throws Error when the file is larger than 1 MiB.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/settings-`);
 * const signal = AbortSignal.timeout(5_000);
 *
 * expect((await readFactorySettings(dir, { signal })).kind).toBe("default");
 *
 * await Bun.write(`${dir}/.claude/factory.json`, '{ "limits": { "reviewRounds": 5 } }');
 * const project = await readFactorySettings(dir, { signal });
 *
 * expect(project.settings.limits.reviewRounds).toBe(5);
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readFactorySettings(
    projectDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<ProjectSettings> {
    const json = await readSettingsJson(path.join(projectDir, FACTORY_SETTINGS_PATH), { signal });

    if (json.kind === "invalid") {
        return { kind: "invalid", settings: DEFAULT_SETTINGS, errors: json.errors };
    }

    if (json.value === null) {
        return { kind: "default", settings: DEFAULT_SETTINGS };
    }

    const settings = parseFactorySettings(json.value);

    if (settings.kind === "invalid") {
        return { kind: "invalid", settings: DEFAULT_SETTINGS, errors: settings.errors };
    }

    return { kind: "project", settings: settings.value };
}

/** The settings file's JSON, `null` when there is no file, or invalid when it isn't JSON. */
async function readSettingsJson(
    settingsPath: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<Parsed<unknown>> {
    try {
        return {
            kind: "valid",
            value: await readJson(settingsPath, { maxBytes: JSON_BYTES_MAX, signal, symbolicLinks: "follow" }).catch(
                whenMissing(null),
            ),
        };
    } catch (error: unknown) {
        if (error instanceof SyntaxError) {
            return { kind: "invalid", errors: ["is not valid JSON"] };
        }
        throw error;
    }
}

/**
 * Renders the tuning values for the session context, so every skill uses the same numbers.
 *
 * @param settings - The project's settings.
 * @returns The section, starting with its heading, without a trailing newline.
 *
 * @example
 * ```ts
 * expect(renderSettingsContext(DEFAULT_SETTINGS)).toContain("| `reviewRounds` | 3 (default) |");
 * ```
 */
export function renderSettingsContext(settings: FactorySettings): string {
    const rows = LIMIT_NAMES.map((name) => {
        const origin = settings.own.has(name) ? "set by the project" : "default";

        return `| \`${name}\` | ${settings.limits[name]} (${origin}) | ${LIMITS[name].use} |`;
    });

    return [
        "## Factory settings",
        "",
        `The project's limits (\`${FACTORY_SETTINGS_PATH}\`, ADR 0058). Skills that name a limit use these values.`,
        "",
        "| Setting | Value | Limits |",
        "| --- | --- | --- |",
        ...rows,
    ].join("\n");
}

/**
 * The JSON Schema of `.claude/factory.json`, generated from the same Zod schema the plugin parses it with, for
 * editors to validate and complete the file.
 *
 * @returns The schema, as formatted JSON with a trailing newline.
 *
 * @example
 * ```ts
 * const schema = JSON.parse(factorySettingsJsonSchema());
 *
 * expect(schema.properties.limits.properties.reviewRounds.maximum).toBe(10);
 * expect(schema.additionalProperties).toBe(false);
 * ```
 */
export function factorySettingsJsonSchema(): string {
    const schema = z.toJSONSchema(FactorySettingsSchema, { target: "draft-2020-12" });

    return `${JSON.stringify({ ...schema, title: "Factory settings (.claude/factory.json)" }, null, 4)}\n`;
}

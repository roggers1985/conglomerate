// Autonomy (ADR 0044): how much Claude decides without asking, set per project in `.claude/factory.json`.

import path from "node:path";
import { z } from "zod";
import { JSON_BYTES_MAX, readJson, readText, TEXT_BYTES_MAX, whenMissing } from "../../../lib/files.ts";
import type { Parsed } from "../../../lib/parse.ts";
import { parse } from "../../../lib/parse.ts";

/** The autonomy levels, from least to most: who decides what (ADR 0044). */
export const AUTONOMY_LEVELS = ["guided", "trusted", "autonomous"] as const;

/** One autonomy level. */
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

/** The level when a project sets none: the owner decides, Claude proposes. */
export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = "guided";

/** Where a project sets its level, relative to the project folder. */
export const FACTORY_SETTINGS_PATH = ".claude/factory.json";

const AUTONOMY_DIR = path.resolve(import.meta.dir, "..", "conventions", "autonomy");

// Our own file, so strict: unknown keys are typos (ADR 0020).
const FactorySettingsSchema = z.strictObject({ autonomy: z.enum(AUTONOMY_LEVELS) });

/** A project's factory settings (`.claude/factory.json`). */
export type FactorySettings = Readonly<z.infer<typeof FactorySettingsSchema>>;

/** A project's autonomy: the level it sets, the default when it sets none, or an invalid settings file. */
export type ProjectAutonomy =
    | { readonly kind: "project"; readonly level: AutonomyLevel }
    | { readonly kind: "default"; readonly level: AutonomyLevel }
    | { readonly kind: "invalid"; readonly level: AutonomyLevel; readonly errors: readonly string[] };

/**
 * Parses the contents of `.claude/factory.json`.
 *
 * @param value - The parsed JSON, not yet trusted.
 * @returns The settings, or every problem found.
 *
 * @example
 * ```ts
 * expect(parseFactorySettings({ autonomy: "trusted" })).toEqual({ kind: "valid", value: { autonomy: "trusted" } });
 * expect(parseFactorySettings({ autonomy: "full" }).kind).toBe("invalid");
 * ```
 */
export function parseFactorySettings(value: unknown): Parsed<FactorySettings> {
    return parse(FactorySettingsSchema, value);
}

/**
 * Reads a project's autonomy level from `.claude/factory.json`.
 *
 * @remarks
 * A missing file means the default level. An invalid file falls back to the default level too, the most careful
 * one, and says why, so a typo never grants more autonomy than intended.
 *
 * @param projectDir - The project folder.
 * @param options.signal - Cancels the read.
 * @returns The project's level, the default, or the default with the errors of an invalid file.
 * @throws Error when the file is larger than 1 MiB.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const { mkdtemp, rm } = await import("node:fs/promises");
 * const { tmpdir } = await import("node:os");
 * const dir = await mkdtemp(`${tmpdir()}/autonomy-`);
 * const signal = AbortSignal.timeout(5_000);
 *
 * expect(await readProjectAutonomy(dir, { signal })).toEqual({ kind: "default", level: "guided" });
 *
 * await Bun.write(`${dir}/.claude/factory.json`, '{ "autonomy": "trusted" }');
 * expect(await readProjectAutonomy(dir, { signal })).toEqual({ kind: "project", level: "trusted" });
 *
 * await rm(dir, { recursive: true });
 * ```
 */
export async function readProjectAutonomy(
    projectDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<ProjectAutonomy> {
    const json = await readSettingsJson(path.join(projectDir, FACTORY_SETTINGS_PATH), { signal });

    if (json.kind === "invalid") {
        return { kind: "invalid", level: DEFAULT_AUTONOMY_LEVEL, errors: json.errors };
    }

    if (json.value === null) {
        return { kind: "default", level: DEFAULT_AUTONOMY_LEVEL };
    }

    const settings = parseFactorySettings(json.value);

    if (settings.kind === "invalid") {
        return { kind: "invalid", level: DEFAULT_AUTONOMY_LEVEL, errors: settings.errors };
    }

    return { kind: "project", level: settings.value.autonomy };
}

/** The settings file's JSON, `null` when there is no file, or invalid when it isn't JSON. */
async function readSettingsJson(
    settingsPath: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<Parsed<unknown>> {
    try {
        return {
            kind: "valid",
            value: await readJson(settingsPath, { maxBytes: JSON_BYTES_MAX, signal }).catch(whenMissing(null)),
        };
    } catch (error: unknown) {
        if (error instanceof SyntaxError) {
            return { kind: "invalid", errors: ["is not valid JSON"] };
        }
        throw error;
    }
}

/**
 * Reads the rules of one autonomy level (`conventions/autonomy/<level>.md`).
 *
 * @param level - The level.
 * @param options.signal - Cancels the read.
 * @returns The level's rules, as Markdown.
 * @throws DOMException named `AbortError` when `signal` aborts.
 *
 * @example
 * ```ts
 * const rules = await readAutonomyRules("guided", { signal: AbortSignal.timeout(5_000) });
 *
 * expect(rules).toContain("The owner decides; you propose.");
 * ```
 */
export function readAutonomyRules(level: AutonomyLevel, { signal }: { readonly signal: AbortSignal }): Promise<string> {
    return readText(path.join(AUTONOMY_DIR, `${level}.md`), { maxBytes: TEXT_BYTES_MAX, signal });
}

const SOURCES: Readonly<Record<ProjectAutonomy["kind"], string>> = {
    project: `set in \`${FACTORY_SETTINGS_PATH}\``,
    default: `the default; a project sets its own in \`${FACTORY_SETTINGS_PATH}\``,
    invalid: `the default, because \`${FACTORY_SETTINGS_PATH}\` is invalid`,
};

/**
 * Renders the autonomy section of the session context: the level, where it comes from, and its rules.
 *
 * @param autonomy - The project's autonomy.
 * @param options.rules - The level's rules, from `readAutonomyRules`.
 * @returns The section, starting with its heading, without a trailing newline.
 *
 * @example
 * ```ts
 * const section = renderAutonomyContext({ kind: "project", level: "trusted" }, { rules: "You decide." });
 *
 * expect(section).toStartWith("## Autonomy: trusted\n");
 * expect(section).toEndWith("You decide.");
 * ```
 */
export function renderAutonomyContext(autonomy: ProjectAutonomy, { rules }: { readonly rules: string }): string {
    const errors = autonomy.kind === "invalid" ? ["", ...autonomy.errors.map((error) => `- ${error}`)] : [];

    return [
        `## Autonomy: ${autonomy.level}`,
        "",
        `This session runs at the \`${autonomy.level}\` level (${SOURCES[autonomy.kind]}).`,
        ...errors,
        "",
        rules.trim(),
    ].join("\n");
}

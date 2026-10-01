// Autonomy (ADR 0044): the rules of each level, and the session context that announces the level.

import path from "node:path";
import { readText, TEXT_BYTES_MAX } from "../../../lib/files.ts";
import type { AutonomyLevel, ProjectSettings } from "./settings.ts";
import { FACTORY_SETTINGS_PATH } from "./settings.ts";

const AUTONOMY_DIR = path.resolve(import.meta.dir, "..", "conventions", "autonomy");

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

const SOURCES: Readonly<Record<ProjectSettings["kind"], string>> = {
    project: `set in \`${FACTORY_SETTINGS_PATH}\``,
    default: `the default; a project sets its own in \`${FACTORY_SETTINGS_PATH}\``,
    invalid: `the default, because \`${FACTORY_SETTINGS_PATH}\` is invalid`,
};

/**
 * Renders the autonomy section of the session context: the level, where it comes from, and its rules.
 *
 * @param project - The project's settings.
 * @param options.rules - The level's rules, from `readAutonomyRules`.
 * @returns The section, starting with its heading, without a trailing newline.
 *
 * @example
 * ```ts
 * const limits = { reviewRounds: 3, parallelTasks: 3, attemptsPerTask: 3, subagentsPerTask: 10 };
 * const settings = { autonomy: "trusted", limits, own: new Set(["autonomy"] as const) } as const;
 * const project = { kind: "project", settings } as const;
 * const section = renderAutonomyContext(project, { rules: "You decide." });
 *
 * expect(section).toStartWith("## Autonomy: trusted\n");
 * expect(section).toEndWith("You decide.");
 * ```
 */
export function renderAutonomyContext(project: ProjectSettings, { rules }: { readonly rules: string }): string {
    const level = project.settings.autonomy;
    const errors = project.kind === "invalid" ? ["", ...project.errors.map((error) => `- ${error}`)] : [];
    const source = project.kind === "project" && !project.settings.own.has("autonomy") ? "default" : project.kind;

    return [
        `## Autonomy: ${level}`,
        "",
        `This session runs at the \`${level}\` level (${SOURCES[source]}).`,
        ...errors,
        "",
        rules.trim(),
    ].join("\n");
}

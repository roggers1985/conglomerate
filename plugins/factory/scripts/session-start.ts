// SessionStart hook: injects the owner's core conventions, the project's autonomy level and the model routing table
// into every Claude Code session.

import path from "node:path";
import { assert } from "../../../lib/assert.ts";
import { readText, TEXT_BYTES_MAX } from "../../../lib/files.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";
import { readAutonomyRules, renderAutonomyContext } from "./autonomy.ts";
import type { Routes } from "./models.ts";
import { readRoutes, renderRoutingContext } from "./models.ts";
import { resolveProjectDir } from "./project-dir.ts";
import { readFactorySettings, renderSettingsContext } from "./settings.ts";

/** The JSON the session-start hook prints; `additionalContext` is added to Claude's context. */
export type SessionStartOutput = {
    readonly hookSpecificOutput: {
        readonly hookEventName: "SessionStart";
        readonly additionalContext: string;
    };
};

/** Absolute path of the owner's always-on conventions (`conventions/core.md`, ADR 0008). */
export const CORE_CONVENTIONS_PATH = path.resolve(import.meta.dir, "..", "conventions", "core.md");

/**
 * Builds the session-start hook output: the core conventions, then the autonomy section, then the model routing.
 *
 * @param conventions - The contents of `conventions/core.md`.
 * @param routes - The routes from `models.json`.
 * @param options.autonomy - The autonomy section, from `renderAutonomyContext` (ADR 0044).
 * @returns The hook output to print as JSON.
 * @throws Error (an `assert` invariant) when the conventions are empty.
 *
 * @example
 * ```ts
 * const output = buildSessionStartOutput(
 *     "# Conventions\n",
 *     { code: { model: "sonnet", effort: "medium", use: "Everyday work" } },
 *     { autonomy: "## Autonomy: guided" },
 * );
 *
 * expect(output.hookSpecificOutput.additionalContext).toStartWith(
 *     "# Conventions\n\n## Autonomy: guided\n\n## Model routing",
 * );
 * ```
 */
export function buildSessionStartOutput(
    conventions: string,
    routes: Routes,
    { autonomy }: { readonly autonomy: string },
): SessionStartOutput {
    assert(conventions.trim().length > 0, "core conventions must not be empty");
    assert(autonomy.trim().length > 0, "the autonomy section must not be empty");

    return {
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: [conventions.trim(), autonomy.trim(), renderRoutingContext(routes)].join("\n\n"),
        },
    };
}

async function main(): Promise<void> {
    const signal = interruptSignal();
    const projectDir = resolveProjectDir({
        argument: Bun.argv[2],
        envProjectDir: process.env["CLAUDE_PROJECT_DIR"],
        cwd: process.cwd(),
    });
    const [conventions, routes, project] = await Promise.all([
        readText(CORE_CONVENTIONS_PATH, { maxBytes: TEXT_BYTES_MAX, signal, symbolicLinks: "follow" }),
        readRoutes({ signal }),
        readFactorySettings(projectDir, { signal }),
    ]);
    const rules = await readAutonomyRules(project.settings.autonomy, { signal });
    const autonomy = [renderAutonomyContext(project, { rules }), renderSettingsContext(project.settings)].join("\n\n");

    console.log(JSON.stringify(buildSessionStartOutput(conventions, routes, { autonomy })));
}

if (import.meta.main) {
    await main();
}

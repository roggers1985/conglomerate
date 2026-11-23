// SessionStart hook: injects the owner's core conventions, the project's autonomy level and the model routing table
// into every Claude Code session. Each part is printed by its own run (`session-start.ts <part> <project folder>`),
// so a part stays within the context cap of 10,000 characters and a failing part leaves the others intact (ADR 0066).

import path from "node:path";
import { assert } from "../../../lib/assert.ts";
import { readText, TEXT_BYTES_MAX } from "../../../lib/files.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";
import { readAutonomyRules, renderAutonomyContext } from "./autonomy.ts";
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
 * The parts of the session-start context, in the order the hook configuration lists them. Each part is a separate
 * run of the script, because Claude Code truncates a hook's context above 10,000 characters.
 *
 * @example
 * ```ts
 * expect(SESSION_START_PARTS).toEqual(["conventions", "autonomy", "routing"]);
 * ```
 */
export const SESSION_START_PARTS = ["conventions", "autonomy", "routing"] as const;

/** One of the parts in `SESSION_START_PARTS`. */
export type SessionStartPart = (typeof SESSION_START_PARTS)[number];

/**
 * The most characters one part may have, so Claude Code does not truncate it.
 *
 * @example
 * ```ts
 * expect(SESSION_START_CONTEXT_CHARACTERS_MAX).toBe(10_000);
 * ```
 */
export const SESSION_START_CONTEXT_CHARACTERS_MAX = 10_000;

async function renderPartText(part: SessionStartPart, projectDir: string, signal: AbortSignal): Promise<string> {
    switch (part) {
        case "conventions":
            return readText(CORE_CONVENTIONS_PATH, { maxBytes: TEXT_BYTES_MAX, signal, symbolicLinks: "follow" });
        case "routing":
            return renderRoutingContext(await readRoutes({ signal }));
        case "autonomy": {
            const project = await readFactorySettings(projectDir, { signal });
            const rules = await readAutonomyRules(project.settings.autonomy, { signal });

            return [renderAutonomyContext(project, { rules }), renderSettingsContext(project.settings)].join("\n\n");
        }
    }
}

/**
 * Renders one part of the session-start context, reading only what that part needs.
 *
 * @param part - Which part to render.
 * @param options.projectDir - The project folder, whose `.claude/factory.json` sets the autonomy level.
 * @param options.signal - Cancels the reading.
 * @returns The trimmed text of the part.
 * @throws Error naming the part, with the reason as its cause, when the part cannot be produced or is empty.
 *
 * @example
 * ```ts
 * const text = await renderSessionStartPart("routing", {
 *     projectDir: process.cwd(),
 *     signal: AbortSignal.timeout(10_000),
 * });
 *
 * expect(text).toStartWith("## Model routing");
 * ```
 */
export async function renderSessionStartPart(
    part: SessionStartPart,
    { projectDir, signal }: { readonly projectDir: string; readonly signal: AbortSignal },
): Promise<string> {
    try {
        const text = (await renderPartText(part, projectDir, signal)).trim();

        assert(text.length > 0, "the part is empty");

        return text;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        throw new Error(`session-start part "${part}" could not be produced: ${reason}`, { cause: error });
    }
}

/**
 * Builds the session-start hook output for one part.
 *
 * @param context - The text of one part, from `renderSessionStartPart`.
 * @returns The hook output to print as JSON.
 * @throws Error (an `assert` invariant) when the text is empty, so a missing part is never delivered as an empty one.
 *
 * @example
 * ```ts
 * const output = buildSessionStartOutput("# Conventions");
 *
 * expect(output.hookSpecificOutput.additionalContext).toBe("# Conventions");
 * ```
 */
export function buildSessionStartOutput(context: string): SessionStartOutput {
    assert(context.trim().length > 0, "a session-start part must not be empty");

    return { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } };
}

async function main(): Promise<void> {
    const signal = interruptSignal();
    const partName = Bun.argv[2];
    const part = SESSION_START_PARTS.find((candidate) => candidate === partName);

    if (part === undefined) {
        console.error(
            `Unknown session-start part "${partName}"; the valid parts are: ${SESSION_START_PARTS.join(", ")}`,
        );
        process.exitCode = 1;

        return;
    }

    const projectDir = resolveProjectDir({
        argument: Bun.argv[3],
        envProjectDir: process.env["CLAUDE_PROJECT_DIR"],
        cwd: process.cwd(),
    });

    try {
        const context = await renderSessionStartPart(part, { projectDir, signal });

        console.log(JSON.stringify(buildSessionStartOutput(context)));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

if (import.meta.main) {
    await main();
}

// SessionStart hook: injects the owner's core conventions and the model routing table into every Claude Code session.

import path from "node:path";
import { assert } from "../../../lib/assert.ts";
import type { Routes } from "./models.ts";
import { readRoutes, renderRoutingContext } from "./models.ts";

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
 * Builds the session-start hook output: the core conventions followed by the model routing section.
 *
 * @param conventions - The contents of `conventions/core.md`.
 * @param routes - The routes from `models.json`.
 * @returns The hook output to print as JSON.
 * @throws Error (an `assert` invariant) when the conventions are empty.
 *
 * @example
 * ```ts
 * const output = buildSessionStartOutput("# Conventions\n", {
 *     code: { model: "sonnet", effort: "medium", use: "Everyday work" },
 * });
 *
 * expect(output.hookSpecificOutput.additionalContext).toStartWith("# Conventions\n\n## Model routing");
 * ```
 */
export function buildSessionStartOutput(conventions: string, routes: Routes): SessionStartOutput {
    assert(conventions.trim().length > 0, "core conventions must not be empty");

    return {
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: `${conventions.trim()}\n\n${renderRoutingContext(routes)}`,
        },
    };
}

async function main(): Promise<void> {
    const [conventions, routes] = await Promise.all([Bun.file(CORE_CONVENTIONS_PATH).text(), readRoutes()]);

    console.log(JSON.stringify(buildSessionStartOutput(conventions, routes)));
}

if (import.meta.main) {
    await main();
}

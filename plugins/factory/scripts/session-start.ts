// SessionStart hook: injects the owner's core conventions and the model routing table into every Claude Code session.

import path from "node:path";
import type { Routes } from "./models.ts";
import { readRoutes, renderRoutingContext } from "./models.ts";

export type SessionStartOutput = {
    readonly hookSpecificOutput: {
        readonly hookEventName: "SessionStart";
        readonly additionalContext: string;
    };
};

export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

export const CORE_CONVENTIONS_PATH = path.resolve(import.meta.dir, "..", "conventions", "core.md");

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

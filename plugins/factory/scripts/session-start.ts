// SessionStart hook: injects the owner's core conventions into every Claude Code session.

import path from "node:path";

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

export function buildSessionStartOutput(conventions: string): SessionStartOutput {
    assert(conventions.trim().length > 0, "core conventions must not be empty");

    return {
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: conventions,
        },
    };
}

async function main(): Promise<void> {
    const conventions = await Bun.file(CORE_CONVENTIONS_PATH).text();

    console.log(JSON.stringify(buildSessionStartOutput(conventions)));
}

if (import.meta.main) {
    await main();
}

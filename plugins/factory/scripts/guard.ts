// PreToolUse hook: asks the owner before the actions that are always the owner's (ADR 0069): a force-push, an edit to
// an accepted ADR, and, at the `guided` level, merging a pull request. The conventions only tell Claude not to do
// these; this makes Claude Code ask, so it holds even when the instruction is forgotten.

import path from "node:path";
import { z } from "zod";
import { readText, whenMissing } from "../../../lib/files.ts";
import { interruptSignal } from "../../../lib/interrupt.ts";
import { parse } from "../../../lib/parse.ts";
import { resolveProjectDir } from "./project-dir.ts";
import type { AutonomyLevel } from "./settings.ts";
import { readFactorySettings } from "./settings.ts";

/** The outcome of the guard: carry on, or ask the owner first, with the reason shown in the prompt. */
export type GuardDecision = { readonly kind: "allow" } | { readonly kind: "ask"; readonly reason: string };

const ALLOW: GuardDecision = { kind: "allow" };

const COMMAND_CHARACTERS_MAX = 100_000; // a longer command is refused unread, so a huge input never reaches the matching
const ADR_BYTES_MAX = 262_144; // an ADR is a page or two; this is far above any real one
const STDIN_CHARACTERS_MAX = 1_000_000;

const SEGMENT_SEPARATORS = /&&|\|\||[;|&\n]/;
const FORCE_FLAG = /^(--force(-with-lease|-if-includes)?(=.*)?|-[A-Za-z]*f[A-Za-z]*)$/;
const ADR_PATH = /(^|\/)docs\/decisions\/\d{4}-[^/]+\.md$/;
const ACCEPTED_STATUS = /^## Status\s+Accepted\b/m;

const wordsOf = (segment: string): string[] =>
    segment
        .trim()
        .split(/\s+/)
        .filter((word) => word !== "");

/**
 * Decides whether a shell command needs the owner's approval first.
 *
 * @remarks
 * Looks at each command in a pipeline or a chain (`;`, `&&`, `||`, `|`). A `git push` with a force flag or a refspec
 * that starts with `+` always asks. `gh pr merge` asks at the `guided` level only. A command it cannot read, because it
 * is longer than {@link COMMAND_CHARACTERS_MAX} characters, asks too: failing closed.
 *
 * @param command - The shell command Claude is about to run.
 * @param options.level - The project's autonomy level.
 * @returns `ask` with the reason, or `allow`.
 *
 * @example
 * ```ts
 * expect(decideCommand("git push --force origin main", { level: "autonomous" }).kind).toBe("ask");
 * expect(decideCommand("git push origin main", { level: "autonomous" }).kind).toBe("allow");
 * expect(decideCommand("gh pr merge 5", { level: "guided" }).kind).toBe("ask");
 * expect(decideCommand("gh pr merge 5", { level: "trusted" }).kind).toBe("allow");
 * ```
 */
export function decideCommand(command: string, { level }: { readonly level: AutonomyLevel }): GuardDecision {
    if (command.length > COMMAND_CHARACTERS_MAX) {
        return { kind: "ask", reason: "The command is too long to check, so the owner decides" };
    }

    const decisions = command.split(SEGMENT_SEPARATORS).map((segment) => decideSegment(wordsOf(segment), level));

    return decisions.find((decision) => decision.kind === "ask") ?? ALLOW;
}

function decideSegment(words: readonly string[], level: AutonomyLevel): GuardDecision {
    const [program, ...rest] = words;

    if (program === "git" && rest.includes("push") && isForcePush(rest)) {
        return { kind: "ask", reason: "A force-push can destroy work on the remote, so it is always the owner's" };
    }

    if (program === "gh" && rest[0] === "pr" && rest[1] === "merge" && level === "guided") {
        return { kind: "ask", reason: "At the guided level the owner merges pull requests" };
    }

    return ALLOW;
}

function isForcePush(args: readonly string[]): boolean {
    const afterPush = args.slice(args.indexOf("push") + 1);
    const hasForceFlag = afterPush.some((arg) => FORCE_FLAG.test(arg));
    const hasForcedRefspec = afterPush.some((arg) => arg.startsWith("+") && arg.length > 1);

    return hasForceFlag || hasForcedRefspec;
}

/**
 * Decides whether an edit of a file needs the owner's approval first: an ADR that is accepted is only changed by the
 * owner, or with the owner's approval.
 *
 * @param filePath - The file Claude is about to write or edit, relative to the project or absolute.
 * @param options.currentContent - The file's content now; `null` when the file does not exist yet.
 * @returns `ask` for an ADR under `docs/decisions/` whose status is Accepted, otherwise `allow`.
 *
 * @example
 * ```ts
 * const accepted = "# 1. Use Bun\n\n## Status\n\nAccepted\n";
 *
 * expect(decideEdit("docs/decisions/0001-use-bun.md", { currentContent: accepted }).kind).toBe("ask");
 * expect(decideEdit("docs/decisions/0001-use-bun.md", { currentContent: "## Status\n\nProposed\n" }).kind).toBe("allow");
 * expect(decideEdit("docs/decisions/0002-new.md", { currentContent: null }).kind).toBe("allow");
 * expect(decideEdit("src/app.ts", { currentContent: accepted }).kind).toBe("allow");
 * ```
 */
export function decideEdit(
    filePath: string,
    { currentContent }: { readonly currentContent: string | null },
): GuardDecision {
    const isAdr = ADR_PATH.test(filePath.split(path.sep).join("/"));

    if (!isAdr || currentContent === null) {
        return ALLOW;
    }

    return ACCEPTED_STATUS.test(currentContent)
        ? { kind: "ask", reason: "This ADR is accepted: changing an accepted ADR is always the owner's" }
        : ALLOW;
}

/**
 * The hook's output for a decision: the JSON Claude Code reads from a PreToolUse hook, or `null` to stay silent.
 *
 * @param decision - What {@link decideCommand} or {@link decideEdit} returned.
 * @returns The output to print as JSON, `null` when the action may go ahead.
 *
 * @example
 * ```ts
 * expect(guardOutput({ kind: "allow" })).toBeNull();
 * expect(guardOutput({ kind: "ask", reason: "No." })?.hookSpecificOutput.permissionDecision).toBe("ask");
 * ```
 */
export function guardOutput(decision: GuardDecision) {
    if (decision.kind === "allow") {
        return null;
    }

    return {
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "ask",
            permissionDecisionReason: decision.reason,
        },
    } as const;
}

// Claude Code's hook input has snake_case keys, which the naming rules don't allow in our code, so the input is read as
// a record and the fields are picked by name. Other tools and fields are ignored, so the guard keeps working when
// Claude Code adds new ones.
const RecordSchema = z.record(z.string(), z.unknown());

const textField = (record: Readonly<Record<string, unknown>>, key: string): string | undefined => {
    const value = record[key];

    return typeof value === "string" ? value : undefined;
};

async function main(): Promise<void> {
    const signal = interruptSignal();
    const stdin = await Bun.stdin.text();

    if (stdin.length > STDIN_CHARACTERS_MAX) {
        console.error(`guard: the hook input is over ${STDIN_CHARACTERS_MAX} characters`);
        process.exitCode = 1;

        return;
    }

    const input = parse(RecordSchema, JSON.parse(stdin));

    if (input.kind === "invalid") {
        console.error(`guard: unexpected hook input: ${input.errors.join("; ")}`);
        process.exitCode = 1;

        return;
    }

    const projectDir = resolveProjectDir({
        argument: undefined,
        envProjectDir: process.env["CLAUDE_PROJECT_DIR"],
        cwd: process.cwd(),
    });
    const toolInput = parse(RecordSchema, input.value["tool_input"]);
    const toolName = textField(input.value, "tool_name");

    if (toolName === undefined || toolInput.kind === "invalid") {
        console.error("guard: unexpected hook input: it needs a tool_name and a tool_input");
        process.exitCode = 1;

        return;
    }

    const command = textField(toolInput.value, "command");
    const filePath = textField(toolInput.value, "file_path");

    const decision =
        toolName === "Bash" && command !== undefined
            ? decideCommand(command, {
                  level: (await readFactorySettings(projectDir, { signal })).settings.autonomy,
              })
            : await decideFile(filePath, projectDir, { signal });
    const output = guardOutput(decision);

    if (output !== null) {
        console.log(JSON.stringify(output));
    }
}

async function decideFile(
    filePath: string | undefined,
    projectDir: string,
    { signal }: { readonly signal: AbortSignal },
): Promise<GuardDecision> {
    if (filePath === undefined) {
        return ALLOW;
    }

    const absolute = path.resolve(projectDir, filePath);

    if (!ADR_PATH.test(absolute.split(path.sep).join("/"))) {
        return ALLOW;
    }

    // A decision record that can't be read (too large, a link) is not let through unchecked.
    try {
        const currentContent = await readText(absolute, {
            maxBytes: ADR_BYTES_MAX,
            signal,
            symbolicLinks: "refuse",
        }).catch(whenMissing(null));

        return decideEdit(absolute, { currentContent });
    } catch (error) {
        signal.throwIfAborted();

        return {
            kind: "ask",
            reason: `The decision record can't be checked (${error instanceof Error ? error.message : String(error)})`,
        };
    }
}

if (import.meta.main) {
    await main();
}

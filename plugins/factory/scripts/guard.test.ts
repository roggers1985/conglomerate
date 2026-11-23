import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decideCommand, decideEdit, guardOutput } from "./guard.ts";

const hookInput = (toolName: string, toolInput: object): object =>
    Object.fromEntries([
        ["tool_name", toolName],
        ["tool_input", toolInput],
    ]);

const GUIDED = { level: "guided", audience: "owner" } as const;
const AUTONOMOUS = { level: "autonomous", audience: "owner" } as const;
const NON_PROGRAMMER = { level: "autonomous", audience: "non-programmer" } as const;

describe("decideCommand", () => {
    for (const command of [
        "git push --force",
        "git push -f origin main",
        "git push origin main --force-with-lease",
        "git push --force-with-lease=main origin main",
        "git push origin +main",
        "git push -uf origin main",
        "git status && git push --force origin main",
        "echo done; git push -f",
        "git -C /tmp/repo push --force",
    ]) {
        it(`asks before: ${command}`, () => {
            expect(decideCommand(command, AUTONOMOUS).kind).toBe("ask");
        });
    }

    for (const command of [
        "git push",
        "git push -u origin change/x",
        "git push origin main",
        "git log --format=%H -f",
        "git commit -m 'no force pushes here'",
        "echo git push --force",
    ]) {
        it(`allows: ${command}`, () => {
            expect(decideCommand(command, AUTONOMOUS).kind).toBe("allow");
        });
    }

    it("asks before merging a pull request at guided, and only there", () => {
        expect(decideCommand("gh pr merge 12 --merge", GUIDED).kind).toBe("ask");
        expect(decideCommand("cd x && gh pr merge 12", GUIDED).kind).toBe("ask");
        expect(decideCommand("gh pr merge 12", { level: "trusted", audience: "owner" }).kind).toBe("allow");
        expect(decideCommand("gh pr merge 12", AUTONOMOUS).kind).toBe("allow");
        expect(decideCommand("gh pr view 12", GUIDED).kind).toBe("allow");
    });

    it("asks when the command is too long to check", () => {
        expect(decideCommand(`echo ${"x".repeat(100_001)}`, AUTONOMOUS).kind).toBe("ask");
        expect(decideCommand(`echo ${"x".repeat(99_000)}`, AUTONOMOUS).kind).toBe("allow");
    });

    it("gives the owner a reason", () => {
        expect(decideCommand("git push -f", AUTONOMOUS)).toEqual({
            kind: "ask",
            reason: "A force-push can destroy work on the remote, so it is always the owner's",
        });
    });
});

describe("decideEdit", () => {
    const accepted = "# 1. X\n\n## Status\n\nAccepted. Extended by ADR 2.\n\n## Context\n";

    it("asks before editing an accepted ADR, by relative or absolute path", () => {
        expect(decideEdit("docs/decisions/0001-x.md", { currentContent: accepted, audience: "owner" }).kind).toBe(
            "ask",
        );
        expect(decideEdit("/repo/docs/decisions/0001-x.md", { currentContent: accepted, audience: "owner" }).kind).toBe(
            "ask",
        );
    });

    it("lets a proposed or superseded ADR be edited", () => {
        expect(
            decideEdit("docs/decisions/0001-x.md", { currentContent: "## Status\n\nProposed\n", audience: "owner" })
                .kind,
        ).toBe("allow");
        expect(
            decideEdit("docs/decisions/0001-x.md", {
                currentContent: "## Status\n\nSuperseded by 2\n",
                audience: "owner",
            }).kind,
        ).toBe("allow");
    });

    it("lets a new ADR be written, and other files be edited", () => {
        expect(decideEdit("docs/decisions/0069-new.md", { currentContent: null, audience: "owner" }).kind).toBe(
            "allow",
        );
        expect(decideEdit("docs/decisions/README.md", { currentContent: accepted, audience: "owner" }).kind).toBe(
            "allow",
        );
        expect(decideEdit("src/decisions/0001-x.md", { currentContent: accepted, audience: "owner" }).kind).toBe(
            "allow",
        );
    });
});

describe("for a non-programmer", () => {
    it("denies what asks the owner, because the owner is not there to ask", () => {
        for (const command of ["git push --force", "git push -f origin x", "gh pr merge 3", "git push origin main"]) {
            expect(decideCommand(command, NON_PROGRAMMER).kind, command).toBe("deny");
        }
    });

    it("denies a push to main or master in any form, and lets a branch be pushed", () => {
        for (const command of [
            "git push origin main",
            "git push origin HEAD:main",
            "git push origin master",
            "git push main",
        ]) {
            expect(decideCommand(command, NON_PROGRAMMER).kind, command).toBe("deny");
        }

        for (const command of ["git push -u origin change/menu", "git push", "git push origin mainline"]) {
            expect(decideCommand(command, NON_PROGRAMMER).kind, command).toBe("allow");
        }
    });

    it("lets the owner push to main", () => {
        expect(decideCommand("git push origin main", AUTONOMOUS).kind).toBe("allow");
    });

    it("denies the strongest of several commands", () => {
        expect(decideCommand("git push --force; git push origin main", GUIDED).kind).toBe("ask");
        expect(decideCommand("git push --force && gh pr merge 1", NON_PROGRAMMER).kind).toBe("deny");
    });

    it("denies an edit of the settings and of an accepted ADR, and nothing else", () => {
        const audience = "non-programmer";
        const accepted = "## Status\n\nAccepted\n";

        for (const file of [".claude/factory.json", "/repo/.claude/settings.json", ".claude/settings.local.json"]) {
            expect(decideEdit(file, { currentContent: "{}", audience }).kind, file).toBe("deny");
            expect(decideEdit(file, { currentContent: "{}", audience: "owner" }).kind, file).toBe("allow");
        }

        expect(decideEdit("docs/decisions/0001-x.md", { currentContent: accepted, audience }).kind).toBe("deny");
        expect(decideEdit("src/menu.tsx", { currentContent: "x", audience }).kind).toBe("allow");
        expect(decideEdit("docs/decisions/0002-new.md", { currentContent: null, audience }).kind).toBe("allow");
    });

    it("prints a deny for the hook", () => {
        expect(guardOutput({ kind: "deny", reason: "No." })?.hookSpecificOutput.permissionDecision).toBe("deny");
    });
});

describe("guardOutput", () => {
    it("prints nothing for allow, and a PreToolUse ask for ask", () => {
        expect(guardOutput({ kind: "allow" })).toBeNull();
        expect(guardOutput({ kind: "ask", reason: "Why." })).toEqual({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "ask",
                permissionDecisionReason: "Why.",
            },
        });
    });
});

describe("guard command", () => {
    const script = path.join(import.meta.dir, "guard.ts");
    let dir = "";

    const run = async (input: unknown, settings: object = { autonomy: "guided" }) => {
        dir = await mkdtemp(path.join(tmpdir(), "guard-"));
        await Bun.write(path.join(dir, ".claude/factory.json"), JSON.stringify(settings));
        await Bun.write(path.join(dir, "docs/decisions/0001-x.md"), "# 1. X\n\n## Status\n\nAccepted\n");

        const command = Bun.spawn(["bun", script], {
            stdin: new Blob([typeof input === "string" ? input : JSON.stringify(input)]),
            stdout: "pipe",
            stderr: "pipe",
            env: Object.fromEntries([
                ["PATH", process.env["PATH"] ?? ""],
                ["HOME", dir],
                ["CLAUDE_PROJECT_DIR", dir],
            ]),
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(command.stdout).text(),
            new Response(command.stderr).text(),
            command.exited,
        ]);
        await rm(dir, { recursive: true, force: true });

        return { stdout, stderr, exitCode };
    };

    it("asks before a pull request merge at the project's guided level", async () => {
        const result = await run(hookInput("Bash", { command: "gh pr merge 3" }));

        expect(result.exitCode).toBe(0);
        expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe("ask");
    });

    it("asks before an edit of an accepted ADR in the project", async () => {
        const result = await run(hookInput("Edit", Object.fromEntries([["file_path", "docs/decisions/0001-x.md"]])));

        expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe("ask");
    });

    it("denies a push to main when the project's audience is a non-programmer", async () => {
        const result = await run(hookInput("Bash", { command: "git push origin main" }), {
            autonomy: "autonomous",
            audience: "non-programmer",
        });

        expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
    });

    it("denies an edit of the project's settings when the audience is a non-programmer", async () => {
        const result = await run(hookInput("Write", Object.fromEntries([["file_path", ".claude/factory.json"]])), {
            audience: "non-programmer",
        });

        expect(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
    });

    it("says nothing about an ordinary command", async () => {
        const result = await run(hookInput("Bash", { command: "bun test" }));

        expect(result).toEqual({ stdout: "", stderr: "", exitCode: 0 });
    });

    it("fails loudly on input it does not understand", async () => {
        const result = await run({ nothing: true });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("unexpected hook input");
    });
});

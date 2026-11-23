# 69. A guard hook for the owner-only actions

Date: 2026-11-23

## Status

Proposed. It becomes accepted when the owner merges the pull request that adds it.

Extends [ADR-0044](0044-autonomy-levels.md): the autonomy levels get a hook that enforces what can be enforced.

## Context

The conventions say that some actions are always the owner's: force-pushing, changing an accepted ADR, and at the `guided` level merging a pull request. Until now that was an instruction to Claude. An instruction is forgotten in a long session, ignored by a subagent that never read it, and does not hold when someone else (a non-programmer, `TODO.md` "Non-programmers in a repository") is at the keyboard.

## Decision

The plugin adds a `PreToolUse` hook, `dist/guard.js`, for the tools `Bash`, `Edit`, `Write` and `MultiEdit`. It makes Claude Code **ask** the owner (`permissionDecision: "ask"`), with the reason in the prompt. It never silently denies, so the owner keeps the decision.

| Action | When it asks |
|---|---|
| `git push` with `--force`, `-f` (also inside a flag group such as `-uf`), `--force-with-lease`, or a refspec starting with `+` | At every level |
| A write or edit to a file under `docs/decisions/` whose Status is Accepted | At every level |
| `gh pr merge` | At `guided` only. At `trusted` and `autonomous` the autonomy rules decide |

- The guard reads each command of a chain or pipeline (`;`, `&&`, `||`, `|`) on its own. A command over 100,000 characters, and an ADR it cannot read, ask: it fails closed.
- It reads the autonomy level from the project's `.claude/factory.json` (default `guided`).
- Input it does not understand makes it exit non-zero with a message; Claude Code then shows the error and carries on, as it does for any hook error. It does not guess.
- It is a safety net, not a security boundary. A command built to hide a force-push (a script that runs it, a variable) is not caught. The permission rules of a project are the boundary.

## Alternatives considered

| Option | Why not |
|---|---|
| Deny instead of ask | The owner sometimes wants exactly this (a justified force-push after a rebase). Asking keeps the decision with them |
| Permission rules in each project's `settings.json` | They have to be copied into every project and drift. A plugin hook is delivered with the conventions |
| Parse the shell fully | A shell parser is a dependency and a large surface. Matching the commands that matter, and failing closed on size, is enough for a net |

## Consequences

- A new bundle (`guard.js`, which inlines Zod like the others) and one more hook entry. It runs before every shell command and file edit, and takes a few milliseconds.
- Editing an accepted ADR, even to add a back-link to its status line, now asks. That is intended: the owner sees each change to an accepted decision.
- The remaining items of the autonomy TODO and the non-programmer guardrails can build on this hook.

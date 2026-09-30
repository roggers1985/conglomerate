# 42. Checkups in worktrees

Date: 2026-09-30

## Status

Accepted. Extended by [ADR-0054](0054-build-verify-and-spike.md): each build task runs in its own worktree too; checkups stay one at a time.

Amends [ADR-0010](0010-recurring-checkups.md) (how checkups are dispatched).

## Context

The runner dispatches each checkup to a subagent, which creates its own branch. The subagents worked in the same folder as the owner's session. During the first `conventions` run, the subagent switched that folder to its checkup branch while the session was writing an ADR, and the ADR could have ended up in the checkup's commit.

Claude Code can give a subagent its own git worktree (`isolation: "worktree"`), a separate working folder under `.claude/worktrees/`, and blocks it from touching the main checkout. According to its documentation, two details need handling:
- a subagent's worktree starts from the default branch *on the remote*, which can be behind the local one. Its skill list then comes from that older checkout;
- a worktree that has commits stays on disk, with an extra `worktree-<name>` branch, until it is removed.

## Decision

- **Every checkup that runs in a subagent gets its own worktree.** Interactive checkups (ADR 0037) still run in the main session.
- **The checkup creates its branch from the local default branch** inside the worktree (`git switch -c checkup/<name>-<today> <default branch>`). It then reads its skill, `CLAUDE.md` and the rest from disk, and installs dependencies from the lockfile before running checks. This is in the protocol.
- **The runner cleans up after each checkup:** it removes the worktree and its `worktree-<name>` branch, and keeps the checkup branch. A worktree with uncommitted changes is left in place and named in the reply.
- **`.claude/worktrees/` is gitignored.** The runner proposes adding it in a project that doesn't have it yet.
- **Still one at a time.** Worktrees make parallel checkups possible, but that would multiply the cost. Two checkups fixing the same file would also conflict, and a later checkup can no longer see an earlier one's branch. Whether to run them in parallel is decided together with worktrees for the build stage.

## Consequences

- A checkup can no longer change the branch or files of the owner's session.
- Each run starts with a dependency install in a fresh checkout, which costs a little time.
- Tests, type checking and linting in the main checkout ignore `.claude/worktrees/`. This was checked for `bun test`, `tsc` and Biome in this repository.

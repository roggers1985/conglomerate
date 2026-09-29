# 9. Pre-commit formatting

Date: 2026-09-29

## Status

Accepted

Amends [ADR-0006](0006-pre-push-quality-gate.md): formatting now also runs at commit time.

## Context

ADR-0006 put every quality gate in `pre-push`, to keep commits fast. The owner wants formatting to happen as early as possible, ideally when files are staged. Git has no pre-add hook, so `pre-commit` is the earliest place for it.

## Decision

- A `pre-commit` hook in `.githooks/pre-commit` runs `biome check --write --staged --linter-enabled=false` on the staged files. This formats them and sorts their imports without linting, and the hook then stages them again.
- The hook refuses to commit when a staged file also has unstaged changes, because staging it again would pull those changes into the commit. The owner stages or stashes the rest first.
- Linting, typecheck, tests and validation stay in `pre-push` (`bun run check`). Commits stay fast, and the full gate runs once before code leaves the machine.
- Staged files that Biome does not handle (e.g. Markdown) are ignored.

## Consequences

- Committed code is always formatted, so diffs never contain formatting noise.
- Commits are not blocked by lint errors. Those surface at push time.
- Partially staged commits (`git add -p`) are refused while the file has other unstaged changes.
- `bun run check` still checks formatting, as a safety net against `git commit --no-verify`.

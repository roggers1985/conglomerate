# 6. Pre-push quality gate

Date: 2026-09-29

## Status

Accepted. Amended by [ADR-0009](0009-pre-commit-formatting.md), which adds formatting at commit time.

## Context

We have four checks: typecheck (ADR-0004), lint (ADR-0005), tests and manifest validation. They only help if they actually run. Agents and humans both forget to run them before pushing.

## Decision

- A single `bun run check` script runs every check in order: typecheck, lint, tests, validate. It stops at the first failure.
- A git `pre-push` hook in `.githooks/pre-push` runs `bun run check`. A failing check blocks the push.
- Hooks are plain shell scripts versioned in `.githooks/`. They are activated with `git config core.hooksPath .githooks`, which the `prepare` script runs automatically on `bun install`. We do not use a hook manager (husky, lefthook), so there are no extra dependencies.
- We use pre-push rather than pre-commit, so local commits stay fast and the full gate runs once before code leaves the machine.

## Consequences

- A fresh clone gets the hook after `bun install`, with no manual step.
- `git push --no-verify` bypasses the hook. That is acceptable for emergencies, and CI should run `bun run check` as well once we have CI.
- If we need many hooks or parallel execution later, we can move to a hook manager with a new ADR.

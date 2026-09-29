# 3. Use Bun for repository tooling

Date: 2026-09-29

## Status

Accepted. The "plain JavaScript" part was superseded by [ADR-0004](0004-use-strict-typescript-for-repository-tooling.md).

Supersedes the tooling decision in [ADR-0002](0002-plugin-repository-layout.md).

## Context

ADR-0002 chose plain Node.js with the built-in `node:test` runner for repository tooling. The owner prefers Bun, which has a runtime, test runner and package manager in one tool.

## Decision

- Repository tooling in `scripts/` runs on Bun and may use Bun APIs (`Bun.file`, `import.meta.dir`, `import.meta.main`).
- Tests use `bun:test` and are run with `bun test`.
- Scripts remain plain JavaScript ESM with no dependencies. Moving to TypeScript needs its own ADR.

## Consequences

- Contributors need Bun installed. Node.js alone can no longer run the tooling.
- This only affects repository tooling. The plugin itself (skills, agents, commands, hooks) does not depend on Bun, so plugin users don't need it.
- Moving to TypeScript would be cheap later, because Bun runs `.ts` files directly.

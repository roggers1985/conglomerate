# 2. Plugin repository layout

Date: 2026-09-29

## Status

Accepted. The tooling decision was superseded by [ADR-0003](0003-use-bun-for-repository-tooling.md).

## Context

The factory should be installable as a Claude Code plugin, and possibly as a GitHub Copilot integration later. Claude Code installs plugins from a *marketplace*: a repository with a `.claude-plugin/marketplace.json` that lists one or more plugins.

## Decision

- The repository root is a marketplace named `conglomerate`.
- Plugins live under `plugins/<name>/`. The first plugin is `factory`.
- Each plugin has a `.claude-plugin/plugin.json` manifest and folders for `skills/`, `agents/`, `commands/` and `hooks/`. They start empty.
- Repository tooling is plain Node.js (ESM, no dependencies) in `scripts/`, tested with the built-in `node:test` runner. The first script, `validate-plugin.mjs`, is a placeholder that shows the shape of the tooling and may be removed later.
- Copilot support is deferred. Factory logic should go in skills where possible, since that format is the most portable.

## Consequences

- Users install with `/plugin marketplace add <owner>/conglomerate` and then `/plugin install factory@conglomerate`.
- Adding a second plugin does not require restructuring the repository.
- Tooling has no install step. Adding dependencies (for example TypeScript) needs its own ADR.

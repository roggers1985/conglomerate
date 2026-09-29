# 7. Factory documents and plugin scripts

Date: 2026-09-29

## Status

Accepted

## Context

The factory plugin is personal and opinionated: it is built for one owner and encodes that owner's conventions. Two questions came up about how it behaves in the projects where it is used.

1. Where do the documents the factory produces (specs, plans, decisions) live?
2. What may the plugin's own executable parts (hook scripts, MCP servers) assume about the machine?

When Claude Code installs a plugin, it copies only the plugin folder (`plugins/factory/`) to its plugin cache and replaces that copy on every update. Nothing from the repository root comes along, including `node_modules`, `package.json` and `tsconfig.json`.

## Decision

### Documents

- Factory documents are written into the project being worked on, never into the plugin.
- They live under `docs/`, in one folder per document type:
  - `docs/specs/`: specifications, output of the intake stage
  - `docs/plans/`: task plans, output of the planning stage
  - `docs/decisions/`: ADRs in the format of ADR-0001
- Files are numbered and kebab-cased, like ADRs: `NNNN-title.md`.
- The plugin ships the templates. The project stores the filled-in documents.
- Documents are committed with the project's own git history. The owner reviews and commits, and the factory does not commit on its own unless a later ADR says so.

### Plugin scripts

- Executable parts of the plugin may assume Bun is installed, and are written in TypeScript that Bun runs directly (no build step).
- They are invoked through `${CLAUDE_PLUGIN_ROOT}`, e.g. `bun ${CLAUDE_PLUGIN_ROOT}/scripts/example.ts`.
- They must not have runtime dependencies: only Bun and Node built-ins. If a dependency is ever unavoidable, bundling it needs a new ADR.
- They follow the same strict TypeScript and Biome rules as the repository tooling (ADR-0004, ADR-0005).

## Consequences

- Specs, plans and decisions sit next to the code they describe and are versioned with it.
- Plugin updates never touch a project's documents.
- The plugin will not work on a machine without Bun. That is accepted, since it is a personal tool.
- `tsconfig.json` and `biome.json` must include the plugin's scripts folder once it exists.

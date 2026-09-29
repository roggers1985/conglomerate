# Conglomerate

This repository is a Claude Code plugin marketplace that holds the `factory` plugin: a software factory built step by step.

## Working agreement

- `TODO.md` holds the agreed next steps. Read it at the start of a session, keep it current while working, and remove items once they are done and committed.
- The owner wants full control. Discuss every addition before making it. Do not add skills, agents, commands, hooks or dependencies unprompted.
- Every accepted decision gets an ADR in `docs/decisions/` (see ADR 0001).
- Read existing ADRs before proposing changes, and do not contradict an accepted ADR without proposing a superseding one.

## Layout

- `.claude-plugin/marketplace.json`: marketplace manifest
- `plugins/factory/`: the plugin (`.claude-plugin/plugin.json`, `skills/`, `agents/`, `commands/`, `hooks/`)
  - `conventions/core.md`: the owner's always-on conventions, injected at session start (ADR 0008)
  - `skills/<domain>-<topic>/`: skills, named domain first (ADR 0013). `code-*` hold coding conventions (ADR 0008, 0011, 0012). Overview: `plugins/factory/CATALOG.md`
  - `checkups/protocol.md`, `skills/checkup/`, `scripts/checkups.ts`: recurring checkups (ADR 0010)
  - `models.json`: which model and effort per task type (ADR 0014); task skills declare `metadata.task` and must match it
  - `scripts/`: plugin scripts run by hooks; Bun + TypeScript, no runtime dependencies (ADR 0007)
- `scripts/`: repository tooling (strict TypeScript, run directly by Bun)
- `docs/decisions/`: architecture decision records
- `docs/checkups/`: this repo's own checkup schedule (`checkups.json`) and reports (ADR 0010)

## TypeScript

- `tsconfig.json` is deliberately very strict (ADR 0004). Do not loosen it to make code compile; fix the code.
- Treat external data (JSON, input) as `unknown` and narrow it by validation. No `as` casts, no `any`.

## Commands

- `bun run check`: run every quality gate (typecheck, lint, test, validate). The pre-push hook runs this (ADR 0006); never bypass it with `--no-verify`.
- A pre-commit hook formats staged files with Biome and re-stages them (ADR 0009). It refuses partially staged files.
- `bun run typecheck`: type-check (Bun does not type-check when running)
- `bun run catalog`: regenerate `plugins/factory/CATALOG.md` after adding, renaming or describing a skill, or changing `models.json` (validate fails otherwise)
- `bun run lint`: lint and format check with Biome (ADR 0005); `bun run lint:fix` to apply fixes. Do not disable rules to get code through; fix the code.
- `bun test`: run all tests
- `bun run validate`: validate the marketplace and plugin manifests
- `claude --plugin-dir plugins/factory`: try the plugin locally

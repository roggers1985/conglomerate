# Conglomerate

This repository is a Claude Code plugin marketplace that holds the `factory` plugin: a software factory built step by step.

## Working agreement

- The owner wants full control. Discuss every addition before making it. Do not add skills, agents, commands, hooks or dependencies unprompted.
- Every accepted decision gets an ADR in `docs/decisions/` (see ADR 0001).
- Read existing ADRs before proposing changes, and do not contradict an accepted ADR without proposing a superseding one.

## Layout

- `.claude-plugin/marketplace.json`: marketplace manifest
- `plugins/factory/`: the plugin (`.claude-plugin/plugin.json`, `skills/`, `agents/`, `commands/`, `hooks/`)
- `scripts/`: repository tooling (strict TypeScript, run directly by Bun)
- `docs/decisions/`: architecture decision records

## TypeScript

- `tsconfig.json` is deliberately very strict (ADR 0004). Do not loosen it to make code compile; fix the code.
- Treat external data (JSON, input) as `unknown` and narrow it by validation. No `as` casts, no `any`.

## Commands

- `bun run check`: run every quality gate (typecheck, lint, test, validate). The pre-push hook runs this (ADR 0006); never bypass it with `--no-verify`.
- `bun run typecheck`: type-check (Bun does not type-check when running)
- `bun run lint`: lint and format check with Biome (ADR 0005); `bun run lint:fix` to apply fixes. Do not disable rules to get code through; fix the code.
- `bun test`: run all tests
- `bun run validate`: validate the marketplace and plugin manifests
- `claude --plugin-dir plugins/factory`: try the plugin locally

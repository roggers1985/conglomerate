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
  - `models.json`: default model and effort per task type (ADR 0014, 0015). `agents/tasks/*.md` are generated from it; skills declare `metadata.task` but never a model
  - `scripts/`: sources of the plugin's scripts; they may import `lib/` and packages (ADR 0020)
  - `dist/`: generated, minified bundles of those scripts, which hooks and skills run. Only entry points (`session-start`, `checkups`, `doctest`) may have an `import.meta.main` block
- `lib/`: own helpers with TSDoc and tests (`assert`, `isNotNil`, `parse`, `readText`/`readJson`, `interruptSignal`, …); add one when it's needed (ADR 0020)
- I/O functions take a required `{ signal }` (ADR 0012). Read files through `lib/files.ts` (Bun's file API takes no signal); a CLI's `main` creates its signal with `interruptSignal()`
- `scripts/`: repository tooling (strict TypeScript, run directly by Bun)
- `docs/decisions/`: architecture decision records
- `docs/checkups/`: this repo's own checkup schedule (`checkups.json`) and reports (ADR 0010)
- `.claude/skills/`: checkups specific to this repo, e.g. `checkup-model-routing` (ADR 0015)

## TypeScript

- `tsconfig.json` is deliberately very strict (ADR 0004). Do not loosen it to make code compile; fix the code.
- Treat external data (JSON, input) as `unknown` and narrow it by validation. No `as` casts, no `any`.
- Every export has full TSDoc with a tested `@example` for functions and classes (ADR 0016). Keep the exported surface small: don't export what only the module itself uses.
- Helpers live in `lib/`; import them, don't copy them. External data (JSON files, frontmatter) is parsed with Zod schemas via `lib/parse.ts` (ADR 0020).

## Commands

- `bun run check`: run every quality gate (typecheck, lint, test, validate). The pre-push hook runs this (ADR 0006); never bypass it with `--no-verify`.
- A pre-commit hook formats staged files with Biome and re-stages them (ADR 0009). It refuses partially staged files.
- `bun run typecheck`: type-check (Bun does not type-check when running)
- `bun run generate`: regenerate `plugins/factory/CATALOG.md`, the task agents (`agents/tasks/`), the bundles (`dist/`) and the plugin's `LICENSE` and `THIRD-PARTY-NOTICES.md` (ADR 0027) after adding, renaming or describing a skill, changing `models.json`, or changing plugin scripts or `lib/` (validate fails otherwise). Never edit generated files by hand.
- `bun run lint`: lint and format check with Biome (ADR 0005); `bun run lint:fix` to apply fixes. Do not disable rules to get code through; fix the code.
- `bun test`: run all tests
- `bun run doctest`: check TSDoc on every export and run every `@example` as a test
- `bun run validate`: validate the marketplace and plugin manifests
- `claude --plugin-dir plugins/factory`: try the plugin from source
- The plugin is installed from this folder as a local marketplace (ADR 0024). It loads in place from this folder, so changes (even uncommitted ones) reach every project's next session or `/reload-plugins` (ADR 0026). Commit before relying on a change elsewhere

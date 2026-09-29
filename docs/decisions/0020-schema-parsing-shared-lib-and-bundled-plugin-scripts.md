# 20. Schema parsing, a shared lib, and bundled plugin scripts

Date: 2026-09-29

## Status

Accepted

Supersedes the "no runtime dependencies, no build step" rule for plugin scripts in [ADR-0007](0007-factory-documents-and-plugin-scripts.md).

## Context

The owner wants external data parsed with schemas, as strictly as possible, using Zod or whatever is recommended at the time. They also want their own small, tested helpers (such as `isNil`) in a lib in this repository, instead of utility libraries like lodash.

Until now, JSON was validated with hand-written checks (`isObject`, `failedRules`). And ADR-0007 said plugin scripts have no runtime dependencies. That was because only the plugin folder is installed: a plugin script can't import `node_modules` or code elsewhere in the repository. The owner asked for whichever option is more readable.

## Decision

### Parsing

- **The boundary:**
  - everything from outside our code is parsed with a schema;
  - impossible states in our own code are guarded with `assert`;
  - our own modules trust each other's types.

  A parse failure is an expected error result; an assert failure is a bug.
- **Library:** Zod 4, used through the Standard Schema interface (`lib/parse.ts`), so switching libraries stays cheap. The `new-features` checkup reviews the choice.
- **Strictness:** `strictObject` for shapes we own (unknown keys are typos). Tolerant objects for formats we don't control, such as Claude Code's skill frontmatter and manifests.
- **Types are inferred from schemas.**
- **Details** are in the `code-parsing` skill, with a summary in `core.md`.

### Shared lib

- **`lib/`** holds small, own helpers with TSDoc, tested examples and unit tests:
  - `assert`;
  - `isNull`, `isUndefined`, `isNil`, `isNotNil`;
  - `parse` (with issue paths);
  - `isFileNotFound`.

  Helpers are added when needed, not in advance. Hard problems use proven libraries.
- **`core.md`** records the general preference: own helpers over utility libraries.

### Bundled plugin scripts

- **The sources** in `plugins/factory/scripts/` import `lib/` and packages normally, so they stay readable.
- **`bun run generate`** bundles the entry points (`session-start`, `checkups`, `doctest`) into self-contained, minified files in `plugins/factory/dist/`. Hooks and skills run those.
- **`bun run validate`** rebuilds and compares, so stale bundles block the push. The output is deterministic.
- **Biome** ignores `dist/`, so the pre-commit hook never reformats the bundles.
- **Only entry points may have an `import.meta.main` block.** In a bundle, that block is true for every module inlined into it, so a second CLI would also run. The unused `models.ts table` command was removed for this reason.

## Consequences

- **Readability:** parsers are shorter and more readable. Error messages include paths (`checkups[0].name: must be kebab-case`), and a misspelled field is now reported instead of ignored.
- **Stricter schedules:** strict schedules reject old extra fields. The jobs project's `checkups.json` must drop `summary`, `lastRun` and `lastReport` before it uses the plugin's checkups (phase 4).
- **Size:** about 190 KB of generated bundles live in git. They are regenerated, never edited.
- **Still Bun:** plugin users still need Bun (ADR-0007), but no `node_modules`.
- **Verified:** a copy of only `plugins/factory/`, without `lib/` or `node_modules`, ran both hooks and a real Claude Code session correctly.

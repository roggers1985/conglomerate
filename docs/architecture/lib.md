# Unit `lib`

Path: `lib/`. Last assessed: 2026-09-30 (first run). Drivers: R1–R4 and L1–L3 in the [register](README.md#drivers).

## To-be

Written from the drivers before comparing with the code.

Two consumers in one repository use this small set of own helpers. One owner and agents change it, and it is never published. The simplest architecture that fits:
- one folder of small modules, one concern per module, each with its tests next to it;
- no imports from anything else in the repository;
- imported by relative path.

It needs no package boundary, version or build of its own, because those serve several consumers or publishing, and neither exists. Modules can be grouped into subfolders once a flat list is no longer easy to scan.

## As-is

- **9 modules, 552 lines without tests.** Every module has a sibling test except `assert.ts`, and every export has TSDoc and a tested example.

  | Module | What | Used by (`factory` / `tooling` files) |
  | ------ | ---- | ------------------------------------- |
  | `files.ts` | Bounded, cancellable file reads | 6 / 5 |
  | `parse.ts` | Standard Schema parsing with issue paths | 4 / 4 |
  | `interrupt.ts` | A CLI's `AbortSignal` from SIGINT/SIGTERM | 4 / 2 |
  | `kebab-case.ts` | The kebab-case pattern | 3 / 2 |
  | `schemas.ts` | Shared Zod schemas (`requiredText`) | 2 / 2 |
  | `assert.ts` | `assert` | 2 / 2, and 4 `lib` modules |
  | `predicates.ts` | `isNull`, `isUndefined`, `isNil`, `isNotNil` (asked for by the owner) | 0 / 2 |
  | `concurrency.ts` | `mapConcurrent` with a bound | 0 / 1 |
  | `errors.ts` | `isFileNotFound` | only `files.ts` |

- **Dependencies:** `assert` is used by `concurrency`, `files`, `parse` and `schemas`; `errors` by `files`. Its packages are `zod` (in `schemas`) and `@standard-schema/spec` (types, in `parse`). It imports nothing from `scripts/` or `plugins/`.
- **Growth:**
  - four modules on 2026-09-29 (`126c6d0`, ADR 0020);
  - `files` and `interrupt` (`a57be17`);
  - `kebab-case` (`3b7604f`);
  - `concurrency` and `schemas` on 2026-09-30 (`adb0bce`).

## Gap

None that hurts: the as-is matches the to-be. The one-way dependency is kept by habit, not by a check. No import breaks it today.

## Evidence (2026-09-30)

- **Four commits touched `lib/`, all repository-wide convention sweeps:** Zod parsing (`126c6d0`), cancellation (`a57be17`), deduplication (`3b7604f`) and bounds (`adb0bce`). Each also touched `factory` and `tooling`. Packages would not have made them smaller, because the conventions apply to all code by design.
- **No sign of pain in the code:**
  - no bug-fix commits in `lib/`;
  - no cycles;
  - no workaround log entries (the log starts with this run);
  - no earlier checkup finding about its structure. The only structural change came from `code-quality` (2026-09-29), which moved duplicated helpers *into* `lib/`.
- **Thin:** the history is two days long.

## Observations

- `predicates`, `concurrency` and `errors` each have one kind of consumer. At this size that doesn't matter.
- The question whether to split `lib/` into workspaces is [ADR 0047](../decisions/0047-keep-lib-as-one-folder-without-workspaces.md) (Proposed).

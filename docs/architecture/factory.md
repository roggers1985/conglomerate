# Unit `factory`

Path: `plugins/factory/`. Last assessed: 2026-09-30 (first run). Drivers: R1–R4 and F1–F5 in the [register](README.md#drivers).

## To-be

Written from the drivers before comparing with the code.

This is a plugin for one agent tool. It is mostly Markdown, plus a few small scripts that hooks and skills run. Because it is distributed as a folder without `node_modules`, the scripts ship as self-contained bundles built from readable sources.

Inside, the simplest architecture that fits is:
- one module per feature (checkup schedule, model routing, autonomy, toolbox, doctest, session start), each parsing its own files with a schema;
- a thin entry point per command;
- shared helpers from `lib` at build time;
- nothing that depends on the repository's tooling.

## As-is

- **Content:**
  - `conventions/` (core plus autonomy levels);
  - 32 skills;
  - `agents/tasks/` (generated from `models.json`);
  - `commands/`;
  - `hooks/hooks.json`;
  - `checkups/protocol.md`;
  - `models.json` and `toolbox.json`.
- **Scripts:** 8 source modules in `scripts/`, 1,392 lines without tests.
  - The entry points `session-start`, `checkups`, `toolbox` and `doctest` are bundled into `dist/`. Each of the first three inlines Zod and is about 98 KB; `doctest.js` is 5 KB.
  - Supporting modules are `models`, `autonomy`, `licenses` and `project-dir`.
- **Internal dependencies:**
  - `session-start` uses `autonomy`, `models` and `project-dir`;
  - `checkups` uses `project-dir`;
  - `toolbox` uses `licenses`, and a type from `checkups`.

  From `lib` it uses `files`, `parse`, `kebab-case`, `schemas`, `interrupt` and `assert`.
- **Data flow:**
  - at session start, hooks run the bundles, which read the project's and the plugin's files, parse them with schemas, and print context for Claude;
  - the `checkup` and `toolbox` skills run the same bundles for a status table;
  - the `code-documentation` skill runs `dist/doctest.js` in other projects.

## Gap

The as-is matches the to-be. One small difference:
- the TypeScript sources and their tests ship in the distributed folder next to the bundles;
- in an installed copy, their `../../../lib/` imports don't resolve.

This is harmless with the local marketplace, which loads the folder in place (ADR 0026). It only matters if the plugin is ever distributed another way (driver R2).

## Evidence (2026-09-30)

- **Hotspot, `checkups.ts`:** 562 lines, the largest module; changed in 12 of the 28 commits that touch TypeScript.
  - Seven of those were repository-wide convention sweeps.
  - Five were features of the checkup system itself (`c6d7c1b`, `697bfc2`, `e92abd6`, `3fe1ee4`, `7e8867f`).
  - It is cohesive: the schedule schema, due logic, reminder rendering and the CLI of one feature.
  - No bug-fix commits.
- **`models.ts`:** 10 changes, the same pattern: sweeps, plus the model-routing features.
- **Thin:** the history is two days long.

## Observations

- **Bundle size:** every Zod-using entry point inlines about 90 KB of Zod. The planned stage gates and enforcing hooks (F4) will add entry points, about 100 KB each in git. That is no pain now.
  - Revisit if bundle size or session-start latency (F3, not measured) becomes a concern.
  - Bun's code splitting could share one chunk inside `dist/`. That is not verified with the deterministic-output check in `bun run validate`.
- **`checkups.ts`:** if it keeps growing, the first cut would split reminder rendering from schedule logic. The next run should look at it first.

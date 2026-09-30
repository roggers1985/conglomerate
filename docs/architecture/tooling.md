# Unit `tooling`

Path: `scripts/`. Last assessed: 2026-09-30 (first run). Drivers: R1–R4, T1 and T2 in the [register](README.md#drivers).

## To-be

Written from the drivers before comparing with the code.

This is build tooling for one repository. It generates derived files from their sources and validates them by regenerating and comparing, with one entry point per command. For the plugin's own formats it reuses the plugin's parsers instead of duplicating their schemas. It depends on the plugin and on `lib`, never the other way around.

## As-is

- **9 modules, 1,266 lines without tests.**
  - Entry points: `generate.ts` and `validate-plugin.ts`.
  - Renderers: `skills.ts` (catalog), `agents.ts` (task agents), `bundles.ts`, and `notices.ts` (license files).
  - `generated.ts` reads and compares generated files, and `dependency-licenses.ts` checks installed packages against the license policy.
- **From `factory`,** it imports:
  - `models.ts`: `readRoutes`, `renderRoutingTable`, and the `Routes` and `TaskRoute` types;
  - `licenses.ts`: `isAllowedLicense`.

  The list of skill domains (`DOMAINS` in `skills.ts`) lives here (ADR 0013).
- **From `lib`,** it uses `files`, `parse`, `schemas`, `kebab-case`, `interrupt`, `assert`, `predicates` and `concurrency`.

## Gap

None that hurts: the as-is matches the to-be.

## Evidence (2026-09-30): the boundary `tooling ↔ factory`

- **12 of the 28 commits that touch TypeScript changed both units.**
  - Seven were repository-wide convention sweeps (`4a6b215`, `ffb3c18`, `126c6d0`, `4ea31c6`, `a57be17`, `3b7604f`, `adb0bce`).
  - The other five were features whose data lives in the plugin and whose generation or validation lives here: model routing and task agents (`5aa437b`, `9335392`), the toolbox (`a9fa4e1`), the license policy (`fd5796d`), and the `autonomy` skill domain (`7e8867f`).

  That coupling is the intended split (ADR 0013, 0020), not a boundary in the wrong place.
- **Hotspots:** `skills.ts` changed in 13 commits and `validate-plugin.ts` in 12, mostly through the same sweeps. No bug-fix commits.
- **Thin:** the history is two days long.

## Observations

- `parseFrontmatter` lives in `skills.ts`. Planned plugin scripts that read stage documents (F4, ADR 0040) will need it. When that happens, it moves to `lib` under the existing rule (helpers are added when needed, ADR 0020).

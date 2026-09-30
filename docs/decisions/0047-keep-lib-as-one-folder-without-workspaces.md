# 47. Keep `lib/` as one folder, without workspaces, for now

Date: 2026-09-30

## Status

Proposed (by the `architecture` checkup, 2026-09-30)

## Context

**Scope:** `repository`. The question is how the repository is split into units: whether `lib/`, and possibly more, become packages in Bun workspaces. See the [architecture register](../architecture/README.md).

**Drivers** (all unconfirmed, from the register):
- R1: one owner, with agents;
- R2: private, public only if it adds something;
- R3: one 3.3-second gate;
- R4: a very high rate of change, mostly Markdown;
- F1: only `plugins/factory/` is distributed, so its scripts are bundled;
- F2: Bun, no `node_modules` at runtime;
- L1: `lib`'s only consumers are in this repository;
- L2: helpers are added when needed.

**The question** (`TODO.md`): `lib/` is growing. Should the repository become a monorepo with packages split by feature, and what would the bundles (ADR 0020), the doctest (ADR 0016), the license notices (ADR 0027) and `bun run check` need?

**As-is:**
- `lib/` has 9 modules and 552 lines without tests. It grew from 4 modules to 9 in about a day and a half.
- Its consumers are the plugin's scripts (bundled) and the repository tooling.
- Dependencies go one way: `tooling → factory → lib` and `tooling → lib`. `lib` imports nothing internal, and there are no cycles.

**Evidence of pain.** It is thin: two days of history, 83 commits, 28 of them touching TypeScript.
- **Change pattern:** `lib/` changed in four commits. All four were repository-wide convention sweeps (Zod parsing, cancellation, deduplication, bounds) that also touched the plugin and the tooling. Packages would not have made those changes smaller, because the conventions apply to all code by design.
- **No structural problems:**
  - no cycles, and no imports against the direction;
  - no bug fixes in `lib/`;
  - no workaround log entries (the log starts now);
  - no earlier checkup finding about `lib`'s structure. The only structural change, by `code-quality` on 2026-09-29, moved duplicated helpers *into* `lib/`.
- **No feature clusters:** most modules are used by both consumers (`files` by 11 files, `parse` by 8, `interrupt` by 6). No group of helpers belongs to one consumer, apart from two tiny modules (`predicates`, `concurrency`).
- **Pain that is coming:** the planned stages (ADR 0040, `TODO.md`) will add plugin scripts that need more helpers, such as frontmatter parsing, which now lives in `scripts/skills.ts`. That is ordinary `lib` growth under ADR 0020, not a reason for packages.
- **A split is technically cheap.** This was verified in a scratch workspace with Bun 1.4.2: `Bun.build` inlines a workspace package from its real path (`packages/<name>/src/…`), not from `node_modules/`. `packageOf` in `scripts/bundles.ts` therefore treats it as the project's own code, and the license notices stay correct.

**What workspaces would give:**
- boundaries that are enforced, since a package exposes only its `exports`;
- dependencies per package;
- versions and publishing per package;
- tasks per package.

This repository needs none of them today: its consumers are all in one repository, there is one owner and one version, the gate takes 3.3 seconds, and nothing is published.

**What they would cost:**
- a `package.json` per package, the workspace configuration and `exports` maps;
- imports in 14 files change from relative paths to package names;
- `tsconfig.json`'s `include` (or project references), the `doctest` script's paths, `CLAUDE.md`'s layout, and the layout described in ADR 0020 all change;
- split by feature at this size, the packages would hold 2 to 225 lines each. Every new helper would first need a decision about which package it belongs in, and every convention sweep, which is how this code actually changes, would touch more manifests;
- `plugins/factory/` must stay outside the workspaces: a `package.json` there would be distributed with the plugin.

## Options

1. **Keep it as it is:** one package, and a flat `lib/`.
   - Cost: none.
   - Benefit: the simplest option, and it matches how the code changes.
   - Risk: once `lib/` is much larger, finding the right helper gets harder. Nothing enforces the dependency direction, but nothing has broken it, and breaking it wouldn't break the bundles.
2. **Keep one package, and enforce the dependency direction:** `lib/` imports nothing from `scripts/` or `plugins/`, and `plugins/factory/scripts/` imports nothing from `scripts/`. This could be Biome's `noRestrictedImports` (present in the installed Biome 2.5; its configuration for this case is not verified) or a check in `bun run validate`.
   - Cost: one rule, with a test that it rejects a wrong import.
   - Benefit: the one real advantage of packages, at little cost.
   - Risk: a rule without evidence that it's needed.
3. **Group `lib/` into subfolders by feature,** without workspaces (e.g. `lib/files/`, `lib/parsing/`).
   - Cost: moving files and updating imports.
   - Benefit: easier to find things once `lib/` is large.
   - Risk: premature at 9 modules.
4. **Bun workspaces:** first `lib` as one package, then a split by feature.
   - Cost: as above.
   - Benefit: enforced boundaries, and ready for publishing.
   - Risk: the most ceremony, for no pain today, and an ongoing cost for every helper.

**Migration paths** for the options that change something. Each step can be released on its own, with `bun run check` green:

- **Option 2:** add the rule, and a test proving that it rejects an import against the direction. One commit.
- **Option 3:** move one feature group at a time and update its imports. One commit per group.
- **Option 4:**
  1. Add `"workspaces": ["packages/*"]`, and move `lib/` unchanged to `packages/lib` as `@conglomerate/lib`, with an export per module. The root `package.json` depends on it (`workspace:*`), and `plugins/factory/` stays outside the workspaces. Update the imports, `tsconfig.json`, the `doctest` paths and `CLAUDE.md`. `bun run validate` then shows whether the bundles and notices changed; they should be byte-identical apart from module names.
  2. Split off a feature group into its own package only when evidence shows a boundary: a group used by one consumer only, a dependency one consumer must not get, or a consumer outside this repository. Keep a re-export in `packages/lib` until every import has moved, then remove it.
  3. Only if the tooling gets dependencies of its own, move it to `packages/tooling`.

## Decision

**Recommended: option 1, keep `lib/` as one flat folder in the one package.**

- No evidence of pain was found, and packages would not make the actual change pattern (repository-wide sweeps) smaller.
- The only consumers are in this repository.
- ADR 0045 prefers the simplest architecture that fits.
- The obstacles to a split are small and verified, so waiting costs nothing: choosing option 4 later costs no more than now.

Option 2 is the next step. It is worth taking the first time an import goes against the direction, or when a second plugin arrives.

If this is accepted:
- the `TODO.md` item closes;
- the register's debt table records the decision as `accepted risk`, expiring on 2027-09-30.

**When to reconsider:**
- A consumer outside this repository needs `lib`: another repository, a second plugin that isn't bundled the same way, or publishing to npm once the repository is public (R2, L1).
- `lib` needs a dependency that one of its consumers must not get.
- `lib` passes a size the owner sets, such as 20 modules or 1,500 lines without tests, or a checkup or the workaround log reports trouble finding or placing helpers. Then option 3 comes first.
- An import goes against the dependency direction. Then option 2.
- `bun run check` becomes slow enough that running it per package would help, for example more than a minute.
- A driver listed above changes.

## Consequences

- **If accepted,** nothing changes in the code. The open question in `TODO.md` gets a recorded answer, with the conditions under which it changes.
- **The sense that `lib/` is growing** becomes a trigger the owner sets and the next run measures, instead of a feeling.
- **If rejected** in favour of option 2, 3 or 4, its migration path above becomes the tracked tasks.

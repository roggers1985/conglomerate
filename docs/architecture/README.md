# Architecture register

The memory of this repository's architecture: what it has to serve, its units, the known debt and the workarounds (ADR 0045, 0046). The `architecture` checkup keeps it. Everyone adds to the [workaround log](#workaround-log) when a task needs a workaround because of the architecture (`core.md`).

## Unit map

One `package.json`, one lockfile, one `tsconfig.json` and one gate (`bun run check`); no workspaces. The three units below are the parts ADR 0045 names. Only `factory` is built and distributed on its own.

| Unit | Path | Purpose | Depends on | Built or deployed | Last assessed |
| ---- | ---- | ------- | ---------- | ----------------- | ------------- |
| `factory` | `plugins/factory/` | The Claude Code plugin: conventions, skills, agents, checkups, hooks, `models.json`, `toolbox.json`. Script sources in `scripts/`, their bundles in `dist/` | `lib` (inlined into the bundles by `bun run generate`), `zod` | Distributed as a folder; loaded in place from the local marketplace (ADR 0024, 0026) | 2026-09-30 ([factory.md](factory.md)) |
| `lib` | `lib/` | The owner's own small helpers (ADR 0020) | Nothing internal; `zod`, `@standard-schema/spec` | Not built on its own: bundled into `factory`, imported by `tooling` | 2026-09-30 ([lib.md](lib.md)) |
| `tooling` | `scripts/` | Generates and validates: catalog, task agents, bundles, license files, manifests | `lib`, `factory` (imports `models.ts` and `licenses.ts`; reads the plugin's files and writes its generated ones) | Runs only in this repository | 2026-09-30 ([tooling.md](tooling.md)) |

**Dependency direction** (as of 2026-09-30, no cycles): `tooling → factory → lib`, and `tooling → lib`. `lib` imports nothing from the other units, and `factory` imports nothing from `tooling`.

## Drivers

What the architecture has to serve. Every driver below was derived on the first run (2026-09-30) from `README.md`, `CLAUDE.md`, `TODO.md`, the ADRs, the two open GitHub issues (#3, #4; neither is about architecture; no milestones) and git history. The owner confirmed or changed R1, R2, R5, F3 and L1 the same day; the rest are still unconfirmed.

### Repository-wide

| # | Driver | Source | Status |
| - | ------ | ------ | ------ |
| R1 | One owner working with agents today; **more people will work on it** later | ADR 0040, `CLAUDE.md`, the owner | changed, confirmed 2026-09-30 |
| R2 | Private; made public only if it clearly adds something. No packages will be published | `TODO.md` ("Before going public"), ADR 0027, the owner | confirmed 2026-09-30 (no timing) |
| R5 | **A second plugin is planned** in this marketplace | the owner | confirmed 2026-09-30 |
| R3 | One quality gate, `bun run check`, in the pre-push hook and CI; 3.3 s on 2026-09-30 | ADR 0006, 0028; measured | measured |
| R4 | Very high rate of change: 83 commits in two days (2026-09-29 and -30), 28 of them touch TypeScript; most changes are Markdown | git history | measured |

### `factory`

| # | Driver | Source | Status |
| - | ------ | ------ | ------ |
| F1 | Only `plugins/factory/` is installed, so its scripts can't import anything outside it: they are bundled | ADR 0007, 0020, 0024, 0026 | unconfirmed |
| F2 | Needs Bun on the machine; no `node_modules` at runtime | ADR 0007, 0020 | unconfirmed |
| F3 | No server load. Three bundles run as hooks at every session start, in every project on the owner's machine. Their latency is not measured | `hooks/hooks.json` | confirmed 2026-09-30: latency isn't noticeable |
| F4 | Planned: the factory stages (triage, intake, planning, convention gate, build, review, finish), hooks that enforce the autonomy levels, and stage gates as scripts. Expect more entry points, and scripts that parse stage documents | `TODO.md`, ADR 0040, 0044 | unconfirmed |
| F5 | Copilot support is an open question | `TODO.md` | unconfirmed |

### `lib`

| # | Driver | Source | Status |
| - | ------ | ------ | ------ |
| L1 | Its only consumers are `factory` and `tooling`, in this repository | code, the owner | confirmed 2026-09-30: nothing outside this repository will use it (a second plugin here may) |
| L2 | Helpers are added when needed, not in advance; own helpers over utility libraries | ADR 0020 | unconfirmed |
| L3 | Every export has TSDoc with a tested example; I/O takes a `{ signal }` | ADR 0012, 0016 | unconfirmed |

### `tooling`

| # | Driver | Source | Status |
| - | ------ | ------ | ------ |
| T1 | Runs only here; regenerates and validates the plugin's generated files | ADR 0020, 0027 | unconfirmed |
| T2 | Being considered: a consistency check across spec, plan and tasks in the validator | `TODO.md` ("To consider") | unconfirmed |

## As-is overview

Per unit, with the to-be, the gap and the observations:

- [`factory`](factory.md)
- [`lib`](lib.md)
- [`tooling`](tooling.md)

## Debt table

| # | Scope | Description | Status | ADR | Drivers | Reconsider when | Expires |
| - | ----- | ----------- | ------ | --- | ------- | --------------- | ------- |
| 1 | `repository` | Whether to split `lib/` (and possibly more) into Bun workspaces with packages by feature. Kept as it is for now; the owner intends to move to workspaces eventually (`TODO.md`). New evidence from the owner: `lib/` mixes unrelated things (weigh option 3 first). The second plugin (R5) triggers option 2 when it arrives | accepted risk | [0047](../decisions/0047-keep-lib-as-one-folder-without-workspaces.md) | R1, R2, R3, R4, R5, F1, F2, L1, L2 | See ADR 0047: a consumer outside this repository, a dependency one consumer must not get, a size limit the owner sets, an import against the direction, a slow gate, or a changed driver | 2027-09-30 |

## Workaround log

Add a line when a task has to work around the architecture: date, scope (`unit <name>`, `boundary <a> ↔ <b>` or `repository`), what and why. The `architecture` checkup turns the entries into evidence and clears the ones it has handled.

None yet.

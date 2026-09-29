# TODO

Work in progress and agreed next steps. Pick up here after an interrupted session.
Remove an item once it is done and committed; the ADRs and git history keep the record.

## Checkups (ADR 0010)

- [ ] Phase 2: generic checkups, one at a time, each discussed first
  - [ ] Run `outdated-packages` and `docs-drift` on this repo for the first time, and refine the skills from what they find
  - [ ] `security`
  - [ ] `new-features`
  - [ ] `test-coverage`
  - [ ] `code-quality`
  - [ ] `frontend-quality`
  - [ ] `unused-code`
  - [ ] `accessibility`, built on the `code-accessibility` tooling (ADR 0011)
  - [ ] `agent-setup`: `CLAUDE.md` size and clarity, skills that never trigger, `.claude/settings.json` permissions, relevant new Claude Code features
  - [ ] `repo-health`: CI speed and failures, skipped/`.only`/flaky tests, pinned CI action versions, git hooks still working, stale branches (including old `checkup/*` branches)
  - [ ] `checkup-retro`: findings that keep coming back unfixed, intervals that are too frequent or too rare, patterns that should become a convention or ADR
  - [ ] `performance` (web apps): Core Web Vitals, bundle size, caching, images, third-party scripts
  - [ ] `seo` (public websites): sitemap, canonical URLs, structured data, redirects, indexing
  - [ ] `licenses`: dependency licenses compatible with the project's own license and use, missing license files
  - [ ] `todos`: TODO/FIXME/HACK comments, lint suppressions (`biome-ignore`, `eslint-disable`), `@ts-expect-error`/`@ts-ignore`; resolve, turn into tasks, or remove
  - [ ] Decide: should the reminder or runner warn up front about a scheduled checkup that has no skill? (Now the runner only notices when it tries to run it.)
  - [ ] Runner: suggest project-specific checkups when it spots the signs (e.g. a privacy page → legal, a database → data quality). Project-specific ones stay out of the plugin: legal, privacy/GDPR, content freshness, analytics, data quality, backups, hosting costs, error monitoring.
- [ ] Phase 3: `claude-code-platform` checkup, project-specific to this repo. Covers only what `agent-setup` doesn't: plugin features (manifest fields, hook events, skill options) and deprecations.
- [ ] Phase 4: move the jobs project to the plugin's checkups (keep its legal, SEO, backfill, … checkups). Its `checkups.json` must first drop `summary`, `lastRun` and `lastReport`: the schedule schema is strict (ADR 0020).

## Conventions

- [ ] Apply the API design convention (ADR 0017) to this repo's scripts: e.g. `isDue(lastRun, intervalDays, today)`, `checkupStatus(checkup, reportFileNames, today)`, `renderDoctestFile(modulePath, label, exports)` take three positional parameters
- [ ] Apply the cancellation convention (ADR 0012) to this repo's scripts where it makes sense (`checkups.ts` loaders, `validate-plugin.ts`): required `{ signal }` on I/O functions, a signal from `main`

## Models

- [ ] First run of the `model-routing` checkup (ADR 0015): decide whether and where to use `fable`

## Factory stages

- [ ] Discuss the first stage: Intake / Specification

## Open questions

- [ ] Remove the duplicated conventions from `~/.claude/CLAUDE.md` once the plugin is in use (ADR 0008)

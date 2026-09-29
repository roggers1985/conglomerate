# TODO

Work in progress and agreed next steps. Pick up here after an interrupted session.
Remove an item once it is done and committed; the ADRs and git history keep the record.

## Checkups (ADR 0010, 0023)

- [ ] First runs of the 11 new checkups in this repo (`/factory:checkup due`, or one at a time), then refine each skill from its "About this checkup" section. This costs time and model usage, so it's a deliberate step.
- [ ] Move the jobs project to the plugin's checkups. Blocked until the plugin is installed there (see "Open questions"). Plan:
  - keep its project-specific checkups (legal, content-freshness, backfill, stale-data, seo, analytics) and any generic ones whose jobs version holds project knowledge, as overrides (ADR 0023);
  - drop the ones where the generic version is enough;
  - remove `summary`, `lastRun` and `lastReport` from its `checkups.json` (the schema is strict, ADR 0020), and replace its own reminder hook and runner with the plugin's.

## Factory stages

- [ ] Discuss the first stage: Intake / Specification

## Open questions

- [ ] How to install the plugin for use in other projects: a GitHub remote for this repository (`/plugin marketplace add <owner>/conglomerate`), or a local marketplace (`/plugin marketplace add /Users/rogiernitschelm/Projects/js/conglomerate`). Installing makes the plugin active in every project.
- [ ] Run `claude update` (this machine is on 2.1.282; Sonnet 5.5 needs 2.1.284) so `sonnet` resolves to Sonnet 5.5 (ADR 0021)
- [ ] Remove the duplicated conventions from `~/.claude/CLAUDE.md` once the plugin is installed (ADR 0008)

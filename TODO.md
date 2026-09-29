# TODO

Work in progress and agreed next steps. Pick up here after an interrupted session.
Remove an item once it is done and committed; the ADRs and git history keep the record.

## Checkups (ADR 0010, 0023)

- [ ] First runs of the 11 new checkups in this repo, then refine each skill from its "About this checkup" section
- [ ] Move the jobs project to the plugin's checkups (the plugin is now installed, ADR 0024). Plan:
  - keep its project-specific checkups (legal, content-freshness, backfill, stale-data, seo, analytics) and any generic ones whose jobs version holds project knowledge, as overrides (ADR 0023);
  - drop the ones where the generic version is enough;
  - remove `summary`, `lastRun` and `lastReport` from its `checkups.json` (the schema is strict, ADR 0020), and replace its own reminder hook and runner with the plugin's.

## Plugin installation (ADR 0024)

- [ ] Verify how updates reach the installed plugin: does `claude plugin update factory@conglomerate` pick up changes without raising `version` in `plugin.json`? Record the answer in CLAUDE.md.

## Factory stages

- [ ] Discuss the first stage: Intake / Specification

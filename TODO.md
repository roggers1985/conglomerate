# TODO

Work in progress and agreed next steps. Pick up here after an interrupted session.
Remove an item once it is done and committed; the ADRs and git history keep the record.

## Checkups (ADR 0010)

- [ ] Phase 2: generic checkups, one at a time, each discussed first
  - [ ] Decide on extra checkups from the coverage review (see the conversation of 2026-09-29)
  - [ ] Run `outdated-packages` and `docs-drift` on this repo for the first time, and refine the skills from what they find
  - [ ] `security`, `new-features`, `test-coverage`, `code-quality`, `frontend-quality`, `unused-code`
  - [ ] `accessibility`, built on the `accessibility-testing` tooling (ADR 0011)
  - [ ] Decide: should the reminder or runner warn up front about a scheduled checkup that has no skill? (Now the runner only notices when it tries to run it.)
- [ ] Phase 3: `claude-code-platform` checkup, project-specific to this repo
- [ ] Phase 4: move the jobs project to the plugin's checkups (keep its legal, SEO, backfill, … checkups). Its `checkups.json` already works as is; the `summary`, `lastRun` and `lastReport` fields can go.

## Factory stages

- [ ] Discuss the first stage: Intake / Specification

## Open questions

- [ ] Remove the duplicated conventions from `~/.claude/CLAUDE.md` once the plugin is in use (ADR 0008)

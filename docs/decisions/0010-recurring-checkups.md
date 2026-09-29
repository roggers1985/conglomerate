# 10. Recurring checkups

Date: 2026-09-29

## Status

Accepted. Amended by [ADR-0023](0023-complete-generic-checkups-and-project-overrides.md): 16 generic checkups; a project's own checkup overrides the plugin's.

## Context

Projects decay quietly: dependencies go out of date, docs drift from the code, legal text falls behind the law, and new language and framework features go unused. In the jobs project the owner built a checkup system to counter this. Each checkup is a skill, and a list of checkups sets how often each should run. A shared protocol governs every run, each run writes a dated report, a startup hook flags overdue priority checkups, and a `/checkup` runner runs each checkup in its own subagent. The owner wants this in the factory for every project, including this repository.

## Decision

We adopt the jobs design with these changes.

### Pieces

- **Protocol** (`plugins/factory/checkups/protocol.md`): one set of rules every checkup follows, plus the report template. It is adapted from the jobs project.
- **Checkups are skills** named `checkup-<name>`.
  - The plugin ships the generic ones: `outdated-packages`, `security`, `new-features`, `test-coverage`, `code-quality`, `frontend-quality`, `unused-code`, `docs-drift`, `accessibility`.
  - A project adds its own in its `.claude/skills/` (e.g. `checkup-legal`).
  - Generic checkups find the stack, the folder structure and the check commands themselves. They do not hard-code paths.
- **Schedule** (`docs/checkups/checkups.json` in the project): an ordered list of `{ name, intervalDays, priority }`. It contains only settings the owner edits.
- **History** (`docs/checkups/<name>/YYYY-MM-DD.md`): one report per run. The last run is the date of the newest report. No state is stored anywhere else.

### Triggers (automation levels 1 and 2)

- **Reminder**: a startup hook (`scripts/checkups.ts reminder`) flags overdue priority checkups firmly, and Claude offers to run them before other work. Other due checkups get one line. When nothing is due, or the project has no `checkups.json`, the hook stays silent.
- **Runner**: the `/factory:checkup [due | all | <name>…]` skill shows the status table (computed by `scripts/checkups.ts status`, not by Claude) and runs the chosen checkups one at a time, each in its own subagent, priority checkups first.
- There are no unattended runs (`claude -p`, cron, scheduled agents). That would be level 3 and needs its own ADR.

### Output

- Each checkup works on a branch `checkup/<name>-YYYY-MM-DD`, commits its report and fixes, and opens a PR when the repository has a GitHub remote. Otherwise it leaves the branch for the owner to merge.

### Differences from the jobs design

- There are no `lastRun`/`lastReport` fields to keep up to date. The reports are the only record of past runs.
- There is no headless runner, and so no permission lists.
- The reminder also mentions non-priority checkups that are due.
- Generic and project-specific checkups are separate.

## Consequences

- Any project with the plugin gets recurring upkeep by adding one `checkups.json`.
- Reports are ordinary documents in the project (as in ADR-0007), but they are named by date because they are a time series.
- Checkups only run when the owner starts a session, so a project nobody opens is not checked. That is accepted at levels 1 and 2.
- This repository uses its own checkups too: generic ones plus a project-specific `claude-code-platform` checkup.

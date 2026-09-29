# 23. The full set of generic checkups, and project overrides

Date: 2026-09-29

## Status

Accepted. Clarified by [ADR-0025](0025-checkup-refinements-after-first-runs.md): checkups that clearly don't apply may be left out of the schedule.

Amends [ADR-0010](0010-recurring-checkups.md): the list of generic checkups is extended, and a project's own checkup overrides the plugin's.

## Context

ADR-0010 named nine generic checkups. A later coverage review added `agent-setup`, `repo-health`, a retrospective, `performance` and `seo`. The owner also wanted separate `licenses` and `todos` checkups. Some questions were still open:
- What should happen when a scheduled checkup has no skill?
- Should the runner suggest project-specific checkups?
- How can a project like jobs keep its detailed versions of checkups the plugin also provides?

## Decision

- **The plugin ships 16 generic checkups:**
  - `outdated-packages`, `security`, `new-features`, `test-coverage`, `code-quality`, `unused-code`, `docs-drift`, `todos`, `licenses`;
  - `agent-setup`, `repo-health`, `retro`;
  - for projects with a UI or website: `frontend-quality`, `accessibility`, `performance`, `seo`. They report "not applicable" and propose their removal elsewhere.

  The retrospective is called `retro` (skill `checkup-retro`), not `checkup-retro`, to avoid `checkup-checkup-retro`.
- **A project's own checkup overrides the plugin's.** When `.claude/skills/checkup-<name>/` exists in the project, the runner uses it instead of `factory:checkup-<name>`. A project can then keep checkups with project-specific knowledge (paths, production rules) and use the generic ones elsewhere.
- **Missing skills are visible.** The status table has a Skill column (`project`, `plugin` or **missing**). A scheduled checkup without a skill is not counted as due, and the session-start reminder mentions it.
- **The runner suggests checkups** that fit the project but aren't scheduled. That includes generic ones, and project-specific ones such as legal, privacy, data quality, backups, analytics and content freshness. It suggests them; it never adds them.
- **This repository schedules 14 checkups:**
  - the generic ones that fit a UI-less plugin repository;
  - `model-routing` and a new `claude-code-platform`, both project-specific, in `.claude/skills/`. `claude-code-platform` also tracks whether GitHub Copilot can run the plugin's skills.

## Consequences

- Every checkup the TODO planned exists. Each one gets refined after its first run, from its "About this checkup" section.
- The jobs project can move to the plugin without losing its detailed checkups: it keeps those as overrides, and drops the ones where the generic version is enough.
- Running all due checkups costs time and model usage. The schedule's intervals keep that spread out; the first runs are a deliberate, owner-started step.

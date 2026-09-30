# TODO

Work in progress and agreed next steps. Pick up here after an interrupted session.
Remove an item once it is done and committed; the ADRs and git history keep the record.

## Checkups (ADR 0010, 0023)

- [ ] Move the jobs project to the plugin's checkups (plugin installed, ADR 0024). Plan:
  - keep its project-specific checkups (legal, content-freshness, backfill, stale-data, seo, analytics) and any generic ones whose jobs version holds project knowledge, as overrides (ADR 0023);
  - drop the ones where the generic version is enough;
  - in its `checkups.json`: remove `summary`, `lastRun` and `lastReport` (the schema is strict, ADR 0020), and turn `priority: true/false` into `"urgent"`/`"normal"` (ADR 0030); then replace its own reminder hook and runner with the plugin's.

## Repository and CI

- [ ] Later, when other work allows: move to Bun workspaces (the owner's intention; ADR 0047 keeps `lib/` as one folder for now). Follow ADR 0047's migration path, and let the `architecture` checkup reassess first: it may advise grouping `lib/` by feature (option 3) or enforcing the dependency direction (option 2, once the second plugin arrives) as the first step, or staying.

## Working with the owner

- [ ] Autonomy levels, next steps (ADR 0044):
  - hooks that enforce what can be enforced, e.g. block `gh pr merge` at `guided`, and force-pushes and edits to accepted ADRs at every level.

## Factory stages

Inspiration from other factories: Superpowers, GitHub Spec Kit, OpenSpec, BMAD, Kiro, and Anthropic's AI-native SDLC playbook.

To build:

- [ ] **Planning:** `plan.md` (architecture, files, data, trade-offs) and `tasks.md` (tasks of a few minutes, with exact files and a verification step each; tasks that can run in parallel marked). Includes back-of-the-envelope sketches of network, disk, memory and CPU costs, with batching as a design question (ADR 0038).
- [ ] **Convention gate:** every plan states that it follows the conventions and ADRs, or justifies each deviation.
- [ ] **Build:** a fresh subagent per task through the task agents (model routing), tests first, and "verify before claiming done".
- [ ] **Git worktrees:** each task in its own worktree, as checkups already are (ADR 0042). Decide then whether checkups may also run in parallel.
- [ ] **Review:** check the result against the plan, with findings by severity (`review` task type).
- [ ] **Finish a branch:** a fixed ending with the choice of merge, PR or discard, and cleanup.

To consider:

- [ ] A consistency check across spec, plan and tasks, e.g. in the validator (Spec Kit's `/analyze`): every `AC-<n>` covered by a task and a test (ADR 0052)
- [ ] A skill for writing skills in the owner's style (Superpowers' `writing-skills`)
- [ ] A systematic debugging skill (Superpowers)
- [ ] Evals for the plugin's skills with `claude plugin eval`: do they trigger, and do they help?
- [ ] Role personas such as analyst or architect (BMAD). Leaning no: the task types already cover this.
- [ ] Copilot: its agent skills only read `.github/skills/`, `.claude/skills/` or `.agents/skills/` in the project, not skills inside a plugin; making the factory's skills available to Copilot needs its own decision (claude-code-platform)

## Before going public

- The license is decided: MIT (ADR 0027).
- [ ] Make the repository public only if it clearly adds something. The comparison and the criteria are in `docs/readiness.md` (ADR 0050), kept current by the `readiness` checkup

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

- [ ] `changes status` and the session-start reminder follow a committed `docs/changes` symbolic link, so titles of another project's changes could appear in the session context (never in a pull request). Compare `realpath(docs/changes)` with the project's own in `readChanges`, and report one invalid entry when they differ (security review of the pr-body change, residual risk 1)

## Factory stages

Inspiration from other factories: Superpowers, GitHub Spec Kit, OpenSpec, BMAD, Kiro, and Anthropic's AI-native SDLC playbook.

To do:

- [ ] Use the stages on a first real change (in this repository or another project), and feed what it shows back into the skills and ADRs (ADR 0056)
- [ ] The pull request description also lists the plan's deviations, not only the route's. Today it says "Deviations: None." while `plan.md` records how the build or review deviated (seen in the writing change, pull request #16)

To consider:

- [ ] A script that checks the evidence in `verification.md`: each named test exists and names its criterion (today the gate checks that evidence is named, and the review agent checks that it holds, ADR 0054, 0055). It could also check that every criterion with a test has a row under Mutation checks in `review.md`, and that the code agent left the test agent's files alone (an empty diff between the task's two branches, ADR 0063)
- [ ] Revisit the default of `subagentsPerChange` after the first change built at `autonomous`. A task with tests now uses two or three subagents, so a change reaches the default of 10 after about four such tasks (ADR 0058, 0063)
- [ ] Let an acceptance criterion carry an indented list. The spec gate reads each criterion as one line, so a criterion with a sub-list is refused. That works against the writing convention, which prefers lists for structure (ADR 0061). Seen in the spec of the keep-behaviour-in-migrations change
- [ ] Qualify the criterion id in new test names with the change's short name (for example `it("migrations AC-5: …")`). Ids like "AC-5" now repeat across changes, so the id alone no longer says which spec a test belongs to. Amends ADR 0054's naming rule; leave existing tests as they are, since renaming them would break their changes' evidence (review of the keep-behaviour-in-migrations change, finding 11)
- [ ] Decide on ADR 0064 (proposed): questions defined in the spec and answered in `verification.md`, checked by the review. Needs the owner's list of default questions; build it after the first real change shows which questions get missed
- [ ] A skill for writing skills in the owner's style (Superpowers' `writing-skills`)
- [ ] A systematic debugging skill (Superpowers)
- [ ] Evals for the plugin's skills with `claude plugin eval`: do they trigger, and do they help?
- [ ] Role personas such as analyst or architect (BMAD). Leaning no: the task types already cover this.
- [ ] Copilot: its agent skills only read `.github/skills/`, `.claude/skills/` or `.agents/skills/` in the project, not skills inside a plugin; making the factory's skills available to Copilot needs its own decision (claude-code-platform)

## Before going public

- The license is decided: MIT (ADR 0027).
- [ ] Make the repository public only if it clearly adds something. The comparison and the criteria are in `docs/readiness.md` (ADR 0050), kept current by the `readiness` checkup

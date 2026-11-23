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

## Factory stages

- [ ] `core.md` says the autonomy level is set "at the end of these conventions". Since ADR 0066 the autonomy rules are a separate part that may arrive first. Reword to "in the autonomy section of the session context" (owner's conventions; found in the review of the session-start-cap change)

Inspiration from other factories: Superpowers, GitHub Spec Kit, OpenSpec, BMAD, Kiro, and Anthropic's AI-native SDLC playbook.

To do:

- [ ] Use the stages on a first real change (in this repository or another project), and feed what it shows back into the skills and ADRs (ADR 0056)

To consider:

- [ ] A script that checks the evidence in `verification.md`: each named test exists and names its criterion (today the gate checks that evidence is named, and the review agent checks that it holds, ADR 0054, 0055). It could also check that every criterion with a test has a row under Mutation checks in `review.md`, and that the code agent left the test agent's files alone (an empty diff between the task's two branches, ADR 0063)
- [ ] Revisit the default of `subagentsPerChange` after the first change built at `autonomous`. A task with tests now uses two or three subagents, so a change reaches the default of 10 after about four such tasks (ADR 0058, 0063)
- [ ] Let an acceptance criterion carry an indented list. The spec gate reads each criterion as one line, so a criterion with a sub-list is refused. That works against the writing convention, which prefers lists for structure (ADR 0061). Seen in the spec of the keep-behaviour-in-migrations change
- [ ] Qualify the criterion id in new test names with the change's short name (for example `it("migrations AC-5: …")`). Ids like "AC-5" now repeat across changes, so the id alone no longer says which spec a test belongs to. Amends ADR 0054's naming rule; leave existing tests as they are, since renaming them would break their changes' evidence (review of the keep-behaviour-in-migrations change, finding 11)
- [ ] Build ADR 0064 (accepted): questions defined in the spec and answered in `verification.md`, checked by the review. Start after the first real change shows which questions get missed; full track
- [ ] A skill for writing skills in the owner's style (Superpowers' `writing-skills`)
- [ ] A systematic debugging skill (Superpowers)
- [ ] Evals for the plugin's skills with `claude plugin eval`: do they trigger, and do they help?
- [ ] Role personas such as analyst or architect (BMAD). Leaning no: the task types already cover this.
- [ ] Copilot: its agent skills only read `.github/skills/`, `.claude/skills/` or `.agents/skills/` in the project, not skills inside a plugin; making the factory's skills available to Copilot needs its own decision (claude-code-platform)

## Less ceremony: scale process with risk

Why: the stages, agents and always-on text cost many tokens on every task, also small ones. Idea: a short always-on core, and process that scales with size and risk. Triage decides how much process to run, and the default is little. Each item below changes a convention or an accepted ADR, so each needs the owner's decision first (a new ADR that amends the old one). None of them is agreed yet.

Proposed tiers:

- Small (a fix, a tweak, a visual change): no triage and no pipeline. Do it, run the checks, report.
- Medium (a feature): one short document with spec and plan, one review at the end.
- Large or risky (money, auth, migrations, architecture): the full pipeline, including the separate test and code agents.

To decide:

- [ ] Measured 2026-11-23 (ADR 0067): about 12 KB of conventions, autonomy rules and routing plus about 17 KB of skill descriptions, roughly 7,000 tokens per session. The skill descriptions are over half of it: shrinking the core saves about 6 KB, leaving out rarely used skills from the list saves more
- [ ] Ask for EARS criteria with evidence per criterion in `verification.md` only where the spec must be exact (ADR 0054, 0055)
- [ ] Require a doc comment with a runnable example only on the public API of a library, not on every internal export (ADR 0016)
- [ ] Write an ADR only for a decision that is hard to reverse. There are about 60 now
- [ ] Collapse the model routing table from nine task types to three tiers (cheap, default, strong), or drop the table and let the session choose (ADR 0021)
- [ ] Keep about four checkups on a schedule (security, outdated packages, docs drift, test coverage). Run the others by hand, and leave their skills out of the session-start list (ADR 0010, 0023)
- [ ] Simplify the autonomy levels: one setting, or a short "ask before" list, instead of three levels with a level per stage (ADR 0044)
- [ ] Add a project-level way to relax the factory for one repository, so a UI-phase project like tuygo can say "no tests for stubs, no per-prop matrices" without forking the plugin

## Non-programmers in a repository

Done in the plugin (ADR 0069, 0070, proposed): the `audience` setting, the `factory-non-programmer` skill, and a guard that denies what would ask the owner. What is left belongs to each project and its host, and has to be set up before a non-programmer starts (first tuygo):

- [ ] Git guardrails in the project: branch protection on `main`, the owner approves every merge, and a `CODEOWNERS` file that requires the owner's review for sensitive paths, `package.json`, lockfiles, `.claude/factory.json` and `.claude/settings*`
- [ ] Permission rules in the project's settings that deny edits outside the frontend paths
- [ ] No production credentials, secrets or paid-service access in a non-programmer's environment: a sandbox with fake data
- [ ] Agree how the frontend repository gets the API's contract (an OpenAPI spec and generated types), so non-programmers work against a sandbox API and never against real data (see the tuygo repository's plan)
- [ ] Check that the skills cover Go: there are cancellation, API design and safety sections, but nothing yet on Go testing or project layout

## Before going public

- The license is decided: MIT (ADR 0027).
- [ ] Make the repository public only if it clearly adds something. The comparison and the criteria are in `docs/readiness.md` (ADR 0050), kept current by the `readiness` checkup

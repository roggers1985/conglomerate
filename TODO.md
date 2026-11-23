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

Why: non-programmers will work in a project (first tuygo), and the owner cannot take risks with money, data, auth and deploys. Waiting for the owner on every technical or permission question would also block them. Idea: they get full autonomy on decisions, inside tight permissions, and the owner's gate moves from the middle of the work to merge time. None of this is agreed yet. Each item that changes a convention or an accepted ADR needs the owner's decision first.

Prerequisites (the guardrails come before anyone is let in):

- [ ] Git guardrails in the project: no direct pushes to `main`, the owner approves every merge, and a `CODEOWNERS` file that requires the owner's review for sensitive paths and for any `package.json` or lockfile change
- [ ] Permission rules that deny edits outside the frontend paths, and deny edits to `.claude/factory.json` and `.claude/settings*`, so a session cannot raise its own level or change its own audience. Cover those files in `CODEOWNERS` as well
- [ ] No production credentials, secrets or paid-service access in a non-programmer's environment. They work against a sandbox with fake data

The audience setting:

- [ ] Add an `audience` setting next to the autonomy level in `.claude/factory.json` (for example `"non-programmer"`; the schema is strict, ADR 0058). It is a role, not a fourth level: the level says how much is decided without asking, the audience says who is at the keyboard and what they can answer. A new ADR amends ADR 0044
- [ ] A short skill, loaded only when `audience` is set, for the non-programmer behaviour:
  - only UX questions, in plain language, about what people see and do, never about how it is built;
  - technical decisions go to a strong subagent (`code-complex`) and are written to a decision log with the reason, so the owner can review them later;
  - output, commit messages and pull request descriptions in plain language
- [ ] The owner-only list stops blocking the work. For an item on it (a new dependency, anything about auth, money or personal data, an API change), the session writes a handoff file, takes the safe side for now, marks it "needs owner review" and carries on with the rest. The owner decides at the pull request, which lists the open items in plain words
- [ ] The most dangerous actions are not asked about at all: force-push, deleting data, production, secrets, paid services and making anything public are blocked by permission rules, and the session only notes them in the handoff file. Check that the hooks from the autonomy TODO (block `gh pr merge`, force-pushes and edits to accepted ADRs) cover this

With the Go API (see the tuygo repository's plan):

- [ ] A session in the frontend repository cannot change the API. A needed API change becomes a request in the handoff file or an issue, never an edit
- [ ] Agree how the frontend repository gets the API's contract (an OpenAPI spec and generated types), so non-programmers work against a sandbox API and never against real data
- [ ] Check that the skills cover Go: there are cancellation, API design and safety sections, but nothing yet on Go testing or project layout

## Before going public

- The license is decided: MIT (ADR 0027).
- [ ] Make the repository public only if it clearly adds something. The comparison and the criteria are in `docs/readiness.md` (ADR 0050), kept current by the `readiness` checkup

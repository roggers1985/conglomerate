# TODO

Work in progress and agreed next steps. Pick up here after an interrupted session.
Remove an item once it is done and committed; the ADRs and git history keep the record.

## Checkups (ADR 0010, 0023)

- [ ] First runs still to do: `todos`, `licenses`, `retro` (done: security, claude-code-platform, code-quality, test-coverage, new-features, agent-setup, repo-health, unused-code)
- [ ] Merge the report-only branches still open: `checkup/security-…` (also adds `.env*` to `.gitignore`), `checkup/claude-code-platform-…`, `checkup/new-features-…`, `checkup/agent-setup-…`, `checkup/repo-health-…`
- [ ] Refinement round from the first runs' "About this checkup" sections:
  - protocol: read files from disk, never trust what the session context says a file contains (agent-setup judged the global CLAUDE.md from a stale copy)
  - protocol: removing or undoing something the owner explicitly asked for always goes under "Needs a human" (unused-code deleted the requested `lib/predicates.ts`)
  - `security`: a small attack surface is reported briefly; this checkup never proposes its own removal
  - `claude-code-platform`: the changelog pages only show ~10 days; read older history by version range or GitHub releases
  - `code-quality`: add *conceptual* consistency (one problem solved two ways, one concept under two names, inconsistent folder layouts), and turn recurring findings into lint rules or validator checks; the "riskiest modules" heuristic needs a fallback for tooling repos
  - `test-coverage`: coverage percentages miss subprocess tests (CLIs run with `Bun.spawn`) and doctest examples
  - `new-features`: merge the two overlapping "revisit what an ADR deferred" scope items
  - `agent-setup`: a missing `.claude/settings.json` is not a finding; "the runner's suggestions" means redoing that judgement, not reading a stored file
  - `unused-code`: exports kept so the doctest enforces docs and tests (entry-point helpers) are not unused
  - dispatch prompts: count branches correctly (the repo-health prompt said "three" and listed four)
- [ ] Decide: should `security` (and maybe `outdated-packages`) be `priority: true` in this repo's schedule? (agent-setup)
- [ ] Test-coverage leftovers: two untested error paths in `validateRepository` (invalid `plugin.json`, name mismatch); the `!result.success` branch in `scripts/bundles.ts` seems unreachable because `Bun.build` throws instead
- [ ] Move the jobs project to the plugin's checkups (plugin installed, ADR 0024). Plan:
  - keep its project-specific checkups (legal, content-freshness, backfill, stale-data, seo, analytics) and any generic ones whose jobs version holds project knowledge, as overrides (ADR 0023);
  - drop the ones where the generic version is enough;
  - remove `summary`, `lastRun` and `lastReport` from its `checkups.json` (the schema is strict, ADR 0020), and replace its own reminder hook and runner with the plugin's.

## Repository and CI

- [ ] Decide: push checkup branches and open PRs now that there is a (private) GitHub remote? Opening PRs needs the `gh` CLI (not installed) and `gh auth login`.
- [ ] CI: a minimal GitHub Actions workflow running `bun run check` on pushes and PRs to `main` (repo-health; ADR 0006 already expected it)
- [ ] Correct ADR 0024's update procedure with a new ADR: a plugin from a *local* marketplace loads from its source folder at every session start or `/reload-plugins`, whatever its `version`; `claude plugin update` isn't needed (claude-code-platform)

## Conventions

- [ ] Turn on Biome's `useFilenamingConvention` (kebab-case) and `useNamingConvention`. The code already passes; one deliberate test fixture (`Code` as an invalid task name) needs a suppression with its reason.

## Factory stages

Inspiration from other factories: Superpowers, GitHub Spec Kit, OpenSpec, BMAD, Kiro, and Anthropic's AI-native SDLC playbook.

To build:

- [ ] **Stage 0: triage.** Classify the task (type, size, risk, reversibility) and propose a route from a fixed set of stages; the owner confirms. Tracks: *quick* (build test-first → verify → short review), *standard* (spec → plan → build → review), *full* (intent → spec → plan → tasks → build → review → docs). Triage may add stages (research spike, security review, migration plan), collapse them (intent + spec in one file) or skip them. The route is written at the top of the task's document, so an interrupted session can resume. Any stage may stop and propose re-triage when the task turns out bigger or riskier.
- [ ] **Intake:** `intent.md` (problem, outcome, affected users and systems, constraints, open questions; written with Claude, corrected by the owner) → `spec.md` (user stories, acceptance criteria, edge cases, no implementation; unclear points marked `[NEEDS CLARIFICATION]` instead of guessed). Owner review before anything is built.
- [ ] **Planning:** `plan.md` (architecture, files, data, trade-offs) and `tasks.md` (tasks of a few minutes, with exact files and a verification step each; tasks that can run in parallel marked).
- [ ] **Convention gate:** every plan states that it follows the conventions and ADRs, or justifies each deviation.
- [ ] **Build:** a fresh subagent per task through the task agents (model routing), tests first, and "verify before claiming done".
- [ ] **Git worktrees:** each task, and each checkup, in its own worktree. This also lets checkups run in parallel instead of one after another.
- [ ] **Review:** check the result against the plan, with findings by severity (`review` task type).
- [ ] **Finish a branch:** a fixed ending with the choice of merge, PR or discard, and cleanup.

To consider:

- [ ] Decide for Intake: specs per change (Spec Kit) or living specs of the current system, with change proposals that are archived when done (OpenSpec)
- [ ] Acceptance criteria in EARS format ("WHEN … THE SYSTEM SHALL …"), which makes them directly testable (Kiro)
- [ ] A consistency check across spec, plan and tasks, e.g. in the validator (Spec Kit's `/analyze`)
- [ ] A skill for writing skills in the owner's style (Superpowers' `writing-skills`)
- [ ] A systematic debugging skill (Superpowers)
- [ ] Evals for the plugin's skills with `claude plugin eval`: do they trigger, and do they help?
- [ ] Role personas such as analyst or architect (BMAD). Leaning no: the task types already cover this.
- [ ] Copilot: its agent skills only read `.github/skills/`, `.claude/skills/` or `.agents/skills/` in the project, not skills inside a plugin; making the factory's skills available to Copilot needs its own decision (claude-code-platform)

## Before going public

- [ ] Compare the factory with existing open-source factories (the ones above and others), and only make the repository public if it clearly adds something

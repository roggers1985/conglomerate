# TODO

Work in progress and agreed next steps. Pick up here after an interrupted session.
Remove an item once it is done and committed; the ADRs and git history keep the record.

## Checkups (ADR 0010, 0023)

- [ ] Test-coverage leftover: two untested error paths in `validateRepository` (invalid `plugin.json`, name mismatch)
- [ ] Move the jobs project to the plugin's checkups (plugin installed, ADR 0024). Plan:
  - keep its project-specific checkups (legal, content-freshness, backfill, stale-data, seo, analytics) and any generic ones whose jobs version holds project knowledge, as overrides (ADR 0023);
  - drop the ones where the generic version is enough;
  - in its `checkups.json`: remove `summary`, `lastRun` and `lastReport` (the schema is strict, ADR 0020), and turn `priority: true/false` into `"urgent"`/`"normal"` (ADR 0030); then replace its own reminder hook and runner with the plugin's.

## Repository and CI

- [ ] Decide: push checkup branches and open PRs now that there is a (private) GitHub remote? Opening PRs needs the `gh` CLI (not installed) and `gh auth login`.

## Conventions

- [ ] Apply the bounds rule (ADR 0032) to this repo's own code: size limits on files read (`lib/files.ts`), maximums in the Zod schemas (`checkups.json` entries, task names, skill descriptions), and a check of every loop
- [ ] Safety practices to discuss, from NASA/JPL's "Power of 10" and TigerBeetle's TigerStyle (candidates for `code-safety`):
  - **Assertion density**: on average two or more assertions per function, covering arguments, return values, preconditions, postconditions and invariants; *pair assertions* (check the same property where data is written and where it is read)
  - **Function length limit**: 60 lines (NASA) or 70 (TigerStyle); Biome's `noExcessiveLinesPerFunction` can enforce it
  - **Every error is handled**: TigerStyle cites that 92% of catastrophic failures come from mishandled non-fatal errors; no swallowed errors, no ignored results (Biome's `noFloatingPromises`, still experimental)
  - **Explicit options for libraries too**: pass timeouts, limits and modes explicitly instead of relying on library defaults (extends ADR 0017)
  - **Smallest scope**: declare variables as close to their use as possible, and keep few variables in play
  - **Names with units and qualifiers last**: `timeoutMs`, `latencyMsMax` rather than `maxLatency` (TigerStyle); no abbreviations
  - **Index, count and size are different things**, and rounding is always explicit (`Math.floor`/`Math.ceil` with a reason)
  - **Back-of-the-envelope sketches** of network, disk, memory and CPU costs in the planning stage, before building
  - **Batching** as a design default for I/O
  - **Zero technical debt**: problems are fixed when found, not deferred without a tracked task (overlaps with the `todos` checkup)
  - **Static analysis at the strictest setting, warnings as errors**: already done (ADR 0004, 0005)

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

- The license is decided: MIT (ADR 0027).
- [ ] Compare the factory with existing open-source factories (the ones above and others), and only make the repository public if it clearly adds something

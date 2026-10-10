# 62. Keep behaviour the same during a migration

Date: 2026-10-04

## Status

Accepted

Applies to the architecture improvements of [ADR-0045](0045-architecture-checkup-and-register.md) and [ADR-0046](0046-reassessing-architecture-when-drivers-change.md): their incremental migration paths are migrations that keep behaviour. Widens triage's migration-plan deviation of [ADR-0051](0051-stage-0-triage.md) to code migrations. Extends the migration plan of [ADR-0053](0053-planning-plan-tasks-and-the-convention-gate.md) with a template and a gate. Adds a first task to the build of [ADR-0054](0054-build-verify-and-spike.md) and a check to the review of [ADR-0055](0055-review-and-security-review.md). Follows [ADR-0038](0038-safety-practices-from-power-of-10-and-tigerstyle.md): it says when and how to write the test, not how many.

## Context

Code often moves from one solution to another without being meant to change what it does. Examples are a library swap, a framework upgrade, a rewrite of a module, or one part of the architecture replaced step by step. Nothing in the factory proved that the new code still behaved like the old code.

A test written after the migration can't give that proof. It shows that the new code does what the new code does. The proof has to come from a test that passed on the old code, and then passes on the new code unchanged.

This matters most in the owner's existing applications. Most changes happen there, much of the old code has no tests, and the architecture checkup proposes improvements as incremental migrations (ADR 0045). Those paths put old and new side by side, but nothing tied the two together with a test.

Before this decision:

- the conventions said to test behaviour, never implementation, but nothing about migrations;
- triage added a migration-plan stage only for schema and data changes;
- the migration plan was a bullet list in the planning skill, without headings and without a script check;
- the review didn't check migrations in any particular way.

## Decision

**A migration meant to keep behaviour first gets a behaviour test.** The test passes on the old code, and then passes on the new code unchanged. It is a *characterization test* (Michael Feathers): it records what the code does now, not what someone thinks it should do. `core.md` says this in one line, and `code-testing` describes how, in the section "Migrations that keep behaviour":

- **It is written before the migration, and seen to pass on the old code.** Old code without tests is the main case.
- **It tests an interface that stays the same:** a public function, an endpoint or a command. Never internals, because they are what the migration changes.
- **It takes one of two forms.** *Side by side*, with old and new behind the same interface (for example a strangler fig), one suite runs against both versions. *In place*, as in a library swap, the test is committed before the swap, and the swap leaves the test unchanged.
- **Every intended difference is listed in the spec and asserted by the test.** Any other difference is a bug. When the differences outnumber what stays the same, it isn't a migration that keeps behaviour, and the convention doesn't apply.
- **When the old code can't run in a test,** for example because it calls an external service, is too slow or needs production data, its real outputs are recorded once and the new code is compared with them. This recording is a *golden master*, kept in the repository like other test data.
- **A migration in several steps** runs the same test after every step.
- **"Unchanged" has one definition,** in `code-testing`: the test cases and their expectations stay the same, in every file the test consists of, recorded outputs included. Only two edits are allowed: adding or removing a version in the side-by-side list, and the assertions for the intended differences the spec lists. Re-recording a golden master from the new code is a change to the test.
- **Running both versions in production and comparing them** (for example GitHub's Scientist) is an option for high-risk migrations, chosen in the migration plan. It isn't a rule.

**The stages enforce it:**

| Stage | What it does |
|---|---|
| Triage | Adds the migration-plan stage for a task that moves code to another solution without meaning to change its behaviour, as it already did for schema and data changes. |
| Migration plan | Has a template with five sections: Steps, Old and new, Behaviour test, Verification and Rollback. The Behaviour test section names the interface the test covers, its form (side by side or in place), every file the test consists of, and where the recorded outputs come from when the old code can't run. For a schema or data migration without such code, it says how the data is checked instead, such as row counts and checksums before and after. |
| Route check | Refuses a done migration plan that misses one of the five sections, or has one empty, or an open `[NEEDS CLARIFICATION]` (`migrationPlanProblems` in `plugins/factory/scripts/stage-gates.ts`, run by `changes.js check`). |
| Build | The first task writes the behaviour test the plan names and runs it on the old code, before any task changes the code under test. `verification.md` records that run under Checks: the command, the commit it ran on, and the result. On the quick track, which has no change folder, the reply and the pull request record it. A data check, for a schema or data migration, runs before and after each step, and both results are recorded. |
| Review | Checks that `verification.md` records the run on the old code, and diffs every file of the test from the commit that added it to the end of the change, against the definition of "unchanged" in `code-testing`. A behaviour test changed in any other way is a **high** finding. The diff doesn't apply to a data check. |

## Consequences

- A migration that keeps behaviour now comes with proof that it did, written and run before the code changed.
- The review checks that the behaviour test stayed unchanged, not a script. A script would have to know which test is the behaviour test and which commit is the swap; the review reads both from the migration plan and the diff. A script can follow if reviews show the need.
- When the test framework itself is migrated, the behaviour test can't stay unchanged inside it. It moves one level up, to a level that doesn't depend on the framework, such as an end-to-end test or running the command and checking its output. The migration plan says so.
- The migration plan now has a gate, which the old bullet list didn't. That holds for schema and data migrations too: their Behaviour test section can't be left empty, but says how the data is checked. No existing change folder has a migration plan, so the gate refuses nothing that exists today.
- The test that runs every stage template through its gate now covers the migration plan's template as well (`scripts/skill-templates.test.ts`).
- Tooling to compare both versions in production isn't part of this decision, and neither is adding behaviour tests to past migrations.

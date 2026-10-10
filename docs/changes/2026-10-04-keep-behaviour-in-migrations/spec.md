# Spec: Keep behaviour the same in migrations, and write tests apart from the code

## Problem

When code moves from one solution to another, it often isn't meant to change what it does. Examples are a library swap, a framework upgrade, a rewrite of a module, or one part of the architecture replaced step by step. Nothing proves that the new code still behaves like the old code.

Tests written after the migration don't help. They prove the new code does what the new code does. The proof has to come from a test that passed on the old code, and then passes on the new code unchanged.

This matters most in the owner's existing applications, where most changes happen and where architecture improvements are migrations (ADR 0045).

The same weakness holds for every change, not only migrations. The agent that writes the code also writes its tests, so a test can repeat the code's own reading of the spec, and the review only sees it afterwards. Three things follow, added to this change at the owner's request (2026-10-10):

- a test is written by an agent that never sees the implementation, apart from the agent that writes the code;
- tests read as a specification, so the intent of the code is clear from them;
- the review proves that a test can fail, and the production code says why, not what.

## Current behaviour

- The conventions say to test behaviour, never implementation (`core.md`, `code-testing`). They say nothing about migrations.
- Triage adds a migration-plan stage only for schema and data changes.
- The migration plan (`factory-planning`) lists its steps, how old and new code coexist, how to verify each step, and how to roll back. It has no template with headings and no script check, unlike the other stage documents.
- The architecture checkup proposes incremental migration paths, with old and new side by side, but no test that ties them together.
- The review doesn't check migrations in any particular way.
- One subagent per task writes the task's tests and its code, test-first (`factory-build`, step 3; ADR 0054). Only the review agent is separate, and only afterwards.
- `code-testing` says what to test and how, but not how a test should read, and the review checks that a named test exists and passes (ADR 0055), not that it can fail.
- The conventions say little about comments in production code.

## Acceptance criteria

- **AC-1**: THE SYSTEM SHALL say in `core.md`, in one line, that a migration meant to keep behaviour first gets a behaviour test that passes on the old code, and then on the new code unchanged.
- **AC-2**: THE SYSTEM SHALL describe in `code-testing` how to write that behaviour test. It is written before the migration and seen to pass on the old code. It tests an interface that stays the same, never internals. Side by side, one suite runs against both versions; replaced in place, the test is committed before the swap and the swap leaves it unchanged. It asserts every intended difference the spec lists. When the old code can't run in a test, it compares with the old code's recorded outputs (a golden master). Running both versions in production and comparing them is an option for high-risk migrations, not a rule.
- **AC-3**: WHEN a task moves code to another solution without meaning to change its behaviour, THE SYSTEM SHALL have triage add the migration-plan stage, as it does for schema and data changes.
- **AC-4**: THE SYSTEM SHALL give the migration plan a template with these sections: Steps, Old and new, Behaviour test, Verification and Rollback. The Behaviour test section names the interface it tests, its form (side by side, or in place), and where the old outputs come from when the old code can't run.
- **AC-5**: WHEN the migration-plan stage is done, THE SYSTEM SHALL refuse a `migration-plan.md` that misses one of those sections, or has one empty, in the route check (`changes.js check`).
- **AC-6**: WHEN a route has a migration plan, THE SYSTEM SHALL have the first build task write the behaviour test and run it on the old code, before any task changes the code under test. `verification.md` records that run.
- **AC-7**: WHEN a route has a migration plan, THE SYSTEM SHALL have the review check that the behaviour test passed on the old code, and that the migration didn't change it except for the intended differences in the spec. A behaviour test changed without a listed reason is a high finding.
- **AC-8**: THE SYSTEM SHALL record the convention in an ADR, and explain "behaviour test" (a characterization test) and "golden master" in the glossary.
- **AC-9**: WHEN a task is built on the standard or full track, THE SYSTEM SHALL have a test agent write its tests from `spec.md`, the task and the conventions only, and commit them failing, before a different code agent starts; the code agent makes them pass. On the quick track one agent does both, and the review checks the tests.
- **AC-10**: WHEN the code agent finds that a test it must make pass is wrong, THE SYSTEM SHALL have it stop without editing the test, and have a separate arbiter agent, given the spec, the test and the failing output, rule whether the code is wrong, the test is wrong, or the spec is unclear. The test agent corrects a wrong test, the code agent carries on when the code is wrong, and an unclear spec goes to the owner. There is at most one arbitration per task, then the owner decides, and the build records each ruling.
- **AC-11**: THE SYSTEM SHALL require in `code-testing` that tests read as a specification: names in domain words that state the behaviour, one behaviour per test, arrange, act and assert visible, and a failure that says which behaviour broke.
- **AC-12**: WHEN the review checks the evidence of a criterion, THE SYSTEM SHALL have the reviewer break the code on purpose for that criterion's test, in a throwaway worktree, and see it fail, and record this in `review.md`. A test that stays green is a finding. Error paths and limits are always covered; a criterion that only changes skill or document text may be skipped.
- **AC-13**: THE SYSTEM SHALL require in `code-readability` and `code-documentation` that comments in production code, which are everything beyond the documentation of an export, say why (a constraint, an ADR, a rejected alternative) at non-obvious places, and never repeat what the code does.
- **AC-14**: THE SYSTEM SHALL record AC-9 to AC-13 in an ADR that amends ADR 0054 and ADR 0055, and explain "test agent", "arbiter" and "mutation check" in the glossary.

## Edge cases

- **The migration also changes behaviour on purpose:** each intended difference is listed in the spec, and the behaviour test asserts it (AC-2, AC-7). When the differences outnumber what stays the same, it isn't a migration that keeps behaviour, and the convention doesn't apply.
- **No tests exist for the old code:** this is the main case. The behaviour test is written against the old code first (AC-6).
- **The old code can't run in a test** (an external service, too slow, needs production data): its real outputs are recorded once, and the new code is compared with them (AC-2).
- **The test framework itself is migrated:** the behaviour test can't stay unchanged inside the framework being replaced. It goes one level up, to a level that doesn't depend on it, such as an end-to-end test or running the command. The migration plan says so (AC-4).
- **A schema or data migration without code that keeps behaviour:** the Behaviour test section says how the data is checked instead, such as counts or checksums before and after (`code-sql`). It is never left empty (AC-5).
- **A migration in several steps, each released on its own:** the same behaviour test runs after every step.
- **The test agent needs the old code's interface** (a migration): it gets the migration plan's Behaviour test section, which names the interface, not the internals (AC-9).
- **The spec itself is wrong or unclear:** neither agent is at fault. The arbiter says so and the owner decides; the spec is amended and the tests follow (AC-10).
- **The arbiter and the code agent disagree with the test agent again:** after the one arbitration the owner decides; no loop (AC-10).
- **A task with no testable behaviour** (renaming, text): the test agent step is skipped, and the task says why (AC-9).
- **Existing change folders:** none has a migration plan, so the new script check refuses nothing that exists today.

## Limits

No numeric limits for the convention: it describes when and how to write the test, not how many (ADR 0038). One arbitration per task (AC-10), so a dispute can't loop; the attempts per task stay as in ADR 0058. The script check reads `migration-plan.md` with the existing 1 MiB limit for change documents.

## Security

- Authentication: Public, because this change adds no entry point: it changes conventions, skills and one check in the local route command.
- Authorisation: none: the route check only reads a change's documents, as before.
- Untrusted input: `migration-plan.md`, read by the existing change-document reader, which refuses symbolic links and files over the limit (ADR 0060).
- Sensitive data: none.

## Out of scope

- Tooling to run both versions in production and compare them. The convention names it as an option, nothing more.
- A script that detects changes to the behaviour test in the diff. The review checks this (AC-7). A script can follow when reviews show it's needed.
- Adding behaviour tests to past migrations.
- New task agent types: the test agent and the arbiter are roles given in the prompt to the existing task agents (`code`, `review`), so `models.json` doesn't change.
- Mutation-testing tooling. The review's break-the-code check is manual and targeted (AC-12).

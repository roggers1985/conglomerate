# Spec: Keep behaviour the same during a migration

## Problem

When code moves from one solution to another, it often isn't meant to change what it does. Examples are a library swap, a framework upgrade, a rewrite of a module, or one part of the architecture replaced step by step. Nothing proves that the new code still behaves like the old code.

Tests written after the migration don't help. They prove the new code does what the new code does. The proof has to come from a test that passed on the old code, and then passes on the new code unchanged.

This matters most in the owner's existing applications, where most changes happen and where architecture improvements are migrations (ADR 0045).

## Current behaviour

- The conventions say to test behaviour, never implementation (`core.md`, `code-testing`). They say nothing about migrations.
- Triage adds a migration-plan stage only for schema and data changes.
- The migration plan (`factory-planning`) lists its steps, how old and new code coexist, how to verify each step, and how to roll back. It has no template with headings and no script check, unlike the other stage documents.
- The architecture checkup proposes incremental migration paths, with old and new side by side, but no test that ties them together.
- The review doesn't check migrations in any particular way.

## Acceptance criteria

- **AC-1**: THE SYSTEM SHALL say in `core.md`, in one line, that a migration meant to keep behaviour first gets a behaviour test that passes on the old code, and then on the new code unchanged.
- **AC-2**: THE SYSTEM SHALL describe in `code-testing` how to write that behaviour test:
  - write it before the migration, and see it pass on the old code;
  - test at an interface that stays the same, never at internals;
  - with old and new side by side, run one suite against both;
  - when the code is replaced in place, commit the test before the swap, and leave it unchanged by the swap;
  - assert every intended difference that the spec lists;
  - when the old code can't run in a test, compare with its recorded outputs (a golden master);
  - running both versions in production and comparing them is an option for high-risk migrations, not a rule.
- **AC-3**: WHEN a task moves code to another solution without meaning to change its behaviour, THE SYSTEM SHALL have triage add the migration-plan stage, as it does for schema and data changes.
- **AC-4**: THE SYSTEM SHALL give the migration plan a template with these sections: Steps, Old and new side by side, Behaviour test, Verification and Rollback. The Behaviour test section names the interface it tests, its form (side by side, or in place), and where the old outputs come from when the old code can't run.
- **AC-5**: WHEN the migration-plan stage is done, THE SYSTEM SHALL refuse a `migration-plan.md` that misses one of those sections, or has one empty, in the route check (`changes.js check`).
- **AC-6**: WHEN a route has a migration plan, THE SYSTEM SHALL have the first build task write the behaviour test and run it on the old code, before any task changes the code under test. `verification.md` records that run.
- **AC-7**: WHEN a route has a migration plan, THE SYSTEM SHALL have the review check that the behaviour test passed on the old code, and that the migration didn't change it except for the intended differences in the spec. A behaviour test changed without a listed reason is a high finding.
- **AC-8**: THE SYSTEM SHALL record the convention in an ADR, and explain "behaviour test" (a characterization test) and "golden master" in the glossary.

## Edge cases

- **The migration also changes behaviour on purpose:** each intended difference is listed in the spec, and the behaviour test asserts it (AC-2, AC-7). When the differences outnumber what stays the same, it isn't a migration that keeps behaviour, and the convention doesn't apply.
- **No tests exist for the old code:** this is the main case. The behaviour test is written against the old code first (AC-6).
- **The old code can't run in a test** (an external service, too slow, needs production data): its real outputs are recorded once, and the new code is compared with them (AC-2).
- **The test framework itself is migrated:** the behaviour test can't stay unchanged inside the framework being replaced. It goes one level up, to a level that doesn't depend on it, such as an end-to-end test or running the command. The migration plan says so (AC-4).
- **A schema or data migration without code that keeps behaviour:** the Behaviour test section says how the data is checked instead, such as counts or checksums before and after (`code-sql`). It is never left empty (AC-5).
- **A migration in several steps, each released on its own:** the same behaviour test runs after every step.
- **Existing change folders:** none has a migration plan, so the new script check refuses nothing that exists today.

## Limits

No numeric limits. The convention describes when and how to write the test, not how many (ADR 0038). The script check reads `migration-plan.md` with the existing 1 MiB limit for change documents.

## Security

- Authentication: Public, because this change adds no entry point: it changes conventions, skills and one check in the local route command.
- Authorisation: none: the route check only reads a change's documents, as before.
- Untrusted input: `migration-plan.md`, read by the existing change-document reader, which refuses symbolic links and files over the limit (ADR 0060).
- Sensitive data: none.

## Out of scope

- Tooling to run both versions in production and compare them. The convention names it as an option, nothing more.
- A script that detects changes to the behaviour test in the diff. The review checks this (AC-7). A script can follow when reviews show it's needed.
- Adding behaviour tests to past migrations.

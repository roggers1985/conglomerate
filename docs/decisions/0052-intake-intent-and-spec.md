# 52. Intake: intent and spec

Date: 2026-09-30

## Status

Accepted

Extends [ADR-0051](0051-stage-0-triage.md).

## Context

After triage, a standard or full route starts with intake:
- the **intent** says what is wrong and what should be different;
- the **spec** says what the system does when the change is done.

This is the first human gate in Anthropic's AI-native SDLC playbook, and the stage where Spec Kit, OpenSpec and Kiro invest most. The open question in `TODO.md` was whether acceptance criteria follow EARS ("WHEN … THE SYSTEM SHALL …"). The owner asked Claude to choose, and to review the result together afterwards.

## Decision

- **One skill, `factory-intake`,** writes `intent.md` and `spec.md` in the change's folder, with the owner. Both stages always run at `guided`.
- **`intent.md`:** Problem, Outcome, Affected, Constraints, Open questions. A page at most.
- **`spec.md`:**
  - **Current behaviour:** what exists today, so an agent working in an existing application builds on it instead of rebuilding it;
  - **Acceptance criteria;**
  - **Edge cases,** found systematically;
  - **Limits:** the bounds of every input, collection and wait (ADR 0032, 0034), decided here rather than invented during the build;
  - **Out of scope.**

  It contains no implementation. When triage combined intent and spec, the spec also has a Problem section.
- **Acceptance criteria in EARS form:** numbered `AC-<n>`, with the keywords in capitals (THE SYSTEM SHALL, WHEN, WHILE, IF … THEN, WHERE), and one testable behaviour each. The ids are stable (never reused), so the plan and the tests can refer to them. That is the basis for a later consistency check across spec, plan and tasks.
- **Unclear points are marked `[NEEDS CLARIFICATION: …]`,** never guessed, with a recommended answer where possible.
- **The gate is a script** (`stage-gates.ts`, applied by `changes.js check` and at session start). A stage marked done fails when:
  - its document is missing, or a required section is absent or empty;
  - a criterion isn't numbered, isn't in EARS form, or reuses an id;
  - a `[NEEDS CLARIFICATION]` is still open.

  The owner's approval stays a human gate at every autonomy level.
- **Why EARS, and not Gherkin (Given/When/Then):**
  - EARS states requirements, while Gherkin states test scenarios; the tests follow from the spec later;
  - it is short, one line per behaviour, and easy to check mechanically;
  - Kiro uses it too.

  Gherkin remains possible in the tests themselves.

## Consequences

- Every standard or full change has a checkable intent and spec before any code is written.
- Criteria in capitals read a little formal. That's the price of their being checkable.
- The next stage, planning, can require each task to name the criteria it covers.

# 55. Review and security review

Date: 2026-09-30

## Status

Accepted. Extended by [ADR-0056](0056-docs-and-finish.md): the docs and finish stages.

Extends [ADR-0054](0054-build-verify-and-spike.md).

## Context

After the build, a change is reviewed before it's finished. `TODO.md` said: check the result against the plan, with findings by severity, as the `review` task type. Two checks were deliberately left to the review:
- the convention gate states that the plan follows the conventions, but not whether the result does (ADR 0053);
- `verification.md` names the evidence for each criterion, but not whether that evidence holds (ADR 0054).

## Decision

- **One skill, `factory-review`,** for the review and security-review stages. **The reviewer is never the builder:** a fresh `review` task agent (Opus, high effort) that only reports. The main session fixes.
- **What it checks:**
  - every active criterion: the behaviour is there, and the named test exists, names its criterion, tests what it claims and passes;
  - nothing beyond the spec or against "Out of scope";
  - the plan followed, and deviations justified;
  - the conventions and ADRs in substance;
  - the quality of the tests;
  - bugs the tests don't catch.
- **The security review** is the same setup, focused on authentication and authorisation, input parsing, secrets, injection, new dependencies and prompt injection. It is written to `security-review.md`, and every security hole is high.
- **Severity:**
  - high: an unmet criterion, a bug, a security hole, data loss;
  - medium: a convention not followed, a missing edge-case test, an unjustified deviation;
  - low: naming and wording.
- **Closing findings:** a fix goes through the build's task flow and is checked again by the reviewer. Acceptance always needs a reason:
  - at `guided`, only the owner accepts;
  - at `trusted` and `autonomous`, Claude may accept medium and low findings, and lists them for the owner;
  - a high finding is fixed, or accepted by the owner, at every level.
- **The gate** (`stage-gates.ts`) refuses a done review when:
  - its summary or findings section is missing;
  - a finding is still open, has an unknown severity, or is accepted without a reason;
  - a high finding is accepted by anyone but the owner.

## Consequences

- The two checks that earlier gates could only check for form, the conventions and the evidence, are now checked in substance.
- A review costs an Opus run per change, which is accepted for the stage that decides whether code is finished.
- The review can send a change back to re-triage instead of patching a result that doesn't fit its plan.

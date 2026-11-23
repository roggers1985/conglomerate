# 68. A short always-on core, and risk-based tests

Date: 2026-11-23

## Status

Proposed. It becomes accepted when the owner merges the pull request that adds it.

Amends [ADR-0008](0008-deliver-owner-conventions-through-the-plugin.md) (what the always-on conventions hold) and [ADR-0031](0031-extensive-tests-and-css-modules.md) (tests are no longer "extensive" everywhere). Builds on [ADR-0067](0067-process-scales-with-size-and-risk.md).

## Context

`core.md` was 9,784 characters, 217 under the hook cap (ADR 0066), and loaded into every session and every subagent. Most of it repeats what the `code-*` skills already say in more detail, and those skills load when the work needs them. The tests rule asked for "extensive" tests everywhere, which in a UI project in its first phase produces tests for stubs and per-prop matrices that cost more than they protect.

## Decision

- **`core.md` keeps what must be true in every session:** how to work with the owner (autonomy, recommended option, triage, push back, the owner-only list, no untracked debt), a one-paragraph core of code style, secure by default, fail fast, limits, parsing at the boundary, optionality, required `AbortSignal`, the license policy, and the tests and documentation rules. It is 5,194 characters, about 31 lines. The rest of the conventions stay in the `code-*` skills, which `core.md` names in its first paragraph.
- **Nothing is dropped from the skills.** The text that left `core.md` was already in a skill (readability, safety, parsing, API design, cancellation, documentation, styling, SQL), except the one-line rules kept in the core.
- **Tests are risk-based:** real state and money, systematic edge cases, accessibility per page, key flows end to end. No tests for stubs and no per-prop matrices. Visual checks are screenshots. `code-testing` says so in its first paragraph.

## Not in this decision

- The documentation rule for internal exports (ADR 0016) and the length of ADRs stay as they are. They are enforced by `doctest.ts` and by habit, so changing them is its own decision.
- The skill descriptions (about 17 KB, the larger part of the session-start text) are not trimmed here.

## Consequences

- A session starts with about 4.6 KB less context, in every subagent too.
- A convention that lived only in `core.md` is now one line shorter. When Claude does not load the matching skill, it may miss a detail. The core's first paragraph names the skills to prevent that, and the checkups read the skills as well.
- There is headroom under the cap again (4,800 characters instead of 217).

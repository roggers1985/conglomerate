# 41. Conventions checkup, first round

Date: 2026-09-30

## Status

Accepted

Extends [ADR-0017](0017-api-design-convention.md) (plain return values for operations that return one value or throw), [ADR-0031](0031-extensive-tests-and-css-modules.md) (web-first assertions) and [ADR-0038](0038-safety-practices-from-power-of-10-and-tigerstyle.md) (three more lint rules, splitting functions, one condition per `assert`).

## Context

The first run of the `conventions` checkup (ADR 0039, report `docs/checkups/conventions/2026-09-30.md`) compared the conventions with their sources and made ten proposals, P1 to P10. The owner accepted the recommendations made on them.

## Decision

- **Adopted:**
  - **P2, `code-react` gets the substance of its sources.** These are React's "You Might Not Need an Effect" and "Rules of React":
    - derive values during render instead of syncing them into state;
    - events belong in event handlers;
    - effects only synchronise with systems outside React;
    - components and hooks are pure;
    - with the React Compiler, no manual memoization.

    The `frontend-quality` checkup already looked for effect-driven state. Now the skill that code is written with says so too.
  - **P3, web-first assertions** in Playwright tests (`code-testing`): they wait and retry, while asserting on a value read first checks only once.
  - **P4, three more Biome rules:** `noEmptyBlockStatements`, `noSkippedTests` and `noFocusedTests`. They enforce "no empty `catch`" (ADR 0038) and "never skip a test". None of them reports anything in the current code.
  - **P5, when splitting a function,** the branching stays in the parent and the helpers that only compute stay pure (TigerStyle).
  - **P6, one condition per `assert`,** so a failure says which condition broke. It is "one condition per `if`" applied to assertions.
  - **P8, the skills' examples follow their own rules:**
    - `code-safety`'s schema example checks for blank text;
    - `code-cancellation`'s `fetchJob` names its timeout and reads the body with a size limit;
    - `code-accessibility` names `color-contrast` as the one rule a component test may turn off, because jsdom can't compute colours and the page-level scan covers it.
  - **P9, `code-api-design` and `core.md` are sharpened:** an operation that reports an outcome as data returns an object or a discriminated union, while an operation that returns one value or throws may return the value itself. The rule now matches the code (`readText`, `readJson`, `readDir`) instead of the other way round.
  - **P10, wording corrected against primary sources:**
    - `core.md` also names EPL as copyleft, and states ADR 0035's rule for SPDX expressions;
    - `code-sql` says that SQLite `STRICT` tables still convert lossless values and that a column is never declared `ANY`, and mentions PostgreSQL 18's `uuidv7()`.
- **Not adopted:**
  - **P1:** an exception to "a counter on every loop" for loops that run until cancelled. Power of 10 and TigerStyle both make that exception, but the owner's rule is deliberately stricter: every loop gets a maximum, even a generous one.
  - **P7:** re-checking shared state after an `await`. Too thin for code that has little concurrency; a project that needs it can bring it up again.

## Consequences

- React code written with the factory is now told what the `frontend-quality` checkup checks.
- Three more lint rules run on every push.
- The next conventions checkup checks whether these proposals were applied, and doesn't propose P1 or P7 again unless something new supports them.

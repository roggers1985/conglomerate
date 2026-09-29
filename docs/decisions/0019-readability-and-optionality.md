# 19. Readability and optionality

Date: 2026-09-29

## Status

Accepted

## Context

The owner optimises code for readability, prefers one condition per rule, wants optionality handled at the boundaries, never uses `null` for collections, and only wants optional chaining on values that can actually be missing.

"One condition per `if`" has a cost. Splitting `a || b` into two `if` statements duplicates the body. For guards (where the body is a return) splitting is fine, but for shared bodies it is not.

## Decision

In `conventions/core.md` (always on), with examples in a new `code-readability` skill:

- **Readability is the top rule.** It wins when other conventions conflict, e.g. a long declarative chain gets named intermediate values.
- **One condition per `if`: each `if` tests one *named* concept.**
  - guards are split into separate early returns;
  - a combined condition is allowed only inside a well-named variable or function (`const isNoLongerValid = isExpired || isRevoked;`);
  - no nested ternaries.

  This is the middle ground between strict one-condition rules and duplicated bodies.
- **Optionality is handled at the boundaries.** Input, config, API responses and database rows are normalised into complete types at the edge; core logic works with complete values.
- **Collections are never `null` or `undefined`.** An empty collection means "nothing".
- **`undefined` means "not provided"** (optional fields and parameters at the boundaries) and is never returned explicitly. **`null` means "deliberately no value"** in a result.
- **`?.` and `??` only on values that can be `null` or `undefined`.**
- **Biome:**
  - `noNestedTernary` and `noUselessUndefined` are turned on;
  - `noUnnecessaryConditions` would enforce the `?.` rule, but it gave false positives on this repository's own code: it claimed `RegExp.exec` never returns `null`. It also missed a real unnecessary `?.` in a test. It stays off; the `new-features` checkup should revisit it.
- This repository's code was brought in line: six `if` statements with combined conditions were rewritten, and `taskOf` now returns `null` instead of `undefined`.

## Consequences

- Code gets slightly longer: more guard clauses and more named booleans. In return, each condition reads as a single idea.
- The `?.` rule depends on review until Biome's type inference improves.
- Validating external data at the boundaries is discussed separately, as a follow-up (schema parsing).

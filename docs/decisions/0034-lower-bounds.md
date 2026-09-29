# 34. Lower bounds

Date: 2026-09-29

## Status

Accepted

Extends [ADR-0032](0032-upper-bounds-on-everything.md).

## Context

ADR-0032 requires an upper bound on everything that can grow. The owner pointed out that the other side matters too: an empty name, a page size of 0, a negative count or a timeout of 0 is as much a bug as an unbounded loop, and often the cause of one (a page size of 0 never advances).

## Decision

- **Values with a meaningful minimum get an explicit lower bound:**
  - counts are `>= 0`;
  - sizes, limits and page sizes are `>= 1`;
  - intervals, timeouts and delays are `> 0`;
  - required strings are non-empty after trimming;
  - required lists have at least one item;
  - ratings and percentages are bounded on both ends.
- **Arithmetic that can drop below zero is asserted to stay `>= 0`:** remaining budgets, decremented counters, durations computed from two timestamps.
- **Related constants are checked against each other** once (e.g. a default size is at most the maximum). "Zero as a special value" (0 meaning unlimited) is avoided, or named and documented where needed.
- **Every bound is tested on both sides:** at the bound, and one past it.
- **Where it's written down:** `core.md` and the `code-safety` skill.

## Consequences

- Schemas get `.min()`, `.positive()` and `.nonnegative()` next to their `.max()`. This repository's own schemas are part of the TODO item for applying ADR 0032.

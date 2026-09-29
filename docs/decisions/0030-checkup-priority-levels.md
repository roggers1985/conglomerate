# 30. Checkup priority levels

Date: 2026-09-29

## Status

Accepted

Amends [ADR-0010](0010-recurring-checkups.md): `priority` becomes a level instead of a boolean.

## Context

`priority` was `true` or `false`. That gave two behaviours at session start: a firm notice with an offer to run the checkup first, or a one-line "also due" notice. Low-value checkups such as `licenses` and `retro` then nag every session once they're due. The boolean couldn't express "don't mention it at all".

## Decision

- **`priority` is one of three levels:**
  - `urgent`: a firm notice at session start, and Claude offers to run it before other work (the old `true`);
  - `normal`: one quiet line, and Claude doesn't bring it up unless asked (the old `false`);
  - `quiet`: not mentioned at session start at all; it only shows in the `/factory:checkup` status table.
- **Three named levels, not a number.** Every level has a distinct, documented effect; with a number it would be unclear what 7 does that 6 doesn't.
- **The runner orders** `urgent`, then `normal`, then `quiet`.
- **Missing skills are always mentioned,** whatever the level, because such a checkup can't run.
- **This repository:** `security` is urgent; `licenses`, `retro` and `todos` are quiet; the rest are normal.

## Consequences

- Schedules with `true`/`false` are rejected (the schedule schema is strict, ADR 0020). The jobs project migrates when it moves to the plugin: `true` becomes `urgent` and `false` becomes `normal`.

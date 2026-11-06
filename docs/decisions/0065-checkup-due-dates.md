# 65. Checkup due dates

Date: 2026-11-06

## Status

Accepted

Amends [ADR-0010](0010-recurring-checkups.md) (when a checkup is due).

## Context

A checkup was due only when its interval had passed. Some checkups matter on a fixed date instead. The jobs project updates its CAO figures on 1 November, 1 December and 3 January, whatever the date of the last run. It solved this with its own `dueDates` key in `docs/checkups/checkups.json`, and its own runner. The plugin's strict schema then rejected the file at every session start.

## Decision

- **A schedule entry may list `dueDates`:** up to 12 dates as `MM-DD`. The date must exist; `02-29` is refused because most years lack it.
- **A checkup is also due** when one of its dates has come, on or before today, since its last run. The interval still applies, so a checkup is due when either rule says so. A date counts in this year or the previous one, so `01-03` still works on 2 January the year before.
- **The status table is unchanged.** `dueDates` is part of the settings that `CheckupConfig` carries (an empty list when the entry has none).

## Consequences

- A project can drop its own due logic and keep one schedule format.
- A checkup whose date has passed is due until it runs, even when its interval is long. That is the point.

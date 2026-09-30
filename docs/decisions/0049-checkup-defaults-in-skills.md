# 49. Checkup defaults in the skills

Date: 2026-09-30

## Status

Accepted

Amends [ADR-0010](0010-recurring-checkups.md) and [ADR-0030](0030-checkup-priority-levels.md) (where a checkup's interval and priority come from).

## Context

A project's schedule (`docs/checkups/checkups.json`) had to set `intervalDays` and `priority` for every checkup. So it was configurable, but the sensible values existed only in this repository's own schedule and in whoever proposed a new one. The owner wants sensible defaults, with the freedom to pick their own intervals.

## Decision

- **Every checkup skill declares its defaults** in its frontmatter: `metadata.intervalDays` (1 to 365) and `metadata.priority` (`urgent`, `normal` or `quiet`). `bun run validate` requires them for every `checkup-*` skill in the plugin.
- **A schedule entry needs only its name.** `intervalDays` and `priority` are optional, and a value in the schedule wins over the default. `{ "name": "security", "intervalDays": 14 }` overrides only the interval.
- **Where the defaults come from:** the project's own skill when it has one that declares them, and otherwise the plugin's. So an override that doesn't care about the schedule keeps the plugin's defaults.
- **A checkup with neither** a value in the schedule nor a default in its skill makes the schedule invalid, with a message that names it.
- **The status table marks the schedule's own values with "(own)"** and explains the mark, so an owner sees at a glance what they changed. To go back to a default, the value is removed from the entry, not copied in.
- **`parseFrontmatter` moves to `lib/`,** because a plugin script now needs it too. The architecture checkup had already expected that move.
- **This repository's schedule is reduced to names,** since its values matched the defaults.

## Consequences

- A new project's schedule can be a list of names.
- Changing a default in a skill changes it for every project that doesn't override it. That is intended; the ADR or the skill's change says why.
- The runner reads each scheduled checkup's `SKILL.md` to find its defaults, which is a few more small file reads at session start.

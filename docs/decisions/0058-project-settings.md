# 58. Project settings

Date: 2026-10-01

## Status

Accepted

Extends [ADR-0044](0044-autonomy-levels.md) (the settings file) and [ADR-0054](0054-build-verify-and-spike.md), [ADR-0055](0055-review-and-security-review.md) (their limits become settings).

## Context

The stages and the autonomy levels contain fixed numbers: 3 review rounds, 3 tasks in parallel, 3 attempts per task, 10 subagents per change. The owner asked whether everything could be configured per project, with a proper JSON Schema, for example 5 review rounds in a project that needs them. They left the choice to Claude.

## Decision

- **One settings file per project:** `.claude/factory.json`, which already held the autonomy level. It now also holds `limits`.
- **Settings are for tuning values, not for rules.**
  - **Configurable:** `reviewRounds`, `parallelTasks`, `attemptsPerTask` and `subagentsPerTask`. Each has a visible default (3, 3, 3 and 10) and bounds (1 to 10, or 1 to 50 for subagents), following ADR 0032 and 0034.
  - **Not configurable:** the rules that make up the plugin's character:
    - what is always the owner's;
    - intent and spec at `guided`;
    - only the owner accepting high findings;
    - secure by default;
    - the stages' gates.

    Making those configurable would undermine acting in the spirit of the plugin.
  - More values are added when a real need appears, each with its default and bounds.
- **A JSON Schema, generated from the same Zod schema** the plugin parses the file with, so the two can't drift apart:
  - `bun run generate` writes `plugins/factory/schemas/factory.schema.json`, and `bun run validate` fails when it's out of date;
  - the file is excluded from Biome, like the other generated output;
  - a project points `"$schema"` at it for validation and completion in an editor.
- **Strict, with a safe fallback:** unknown keys are errors (typos). An invalid file falls back to all defaults, including `guided`, and session start says why (fail safe, ADR 0048).
- **Delivered at session start:** after the autonomy section comes a "Factory settings" section with every value, and whether it is the default or set by the project. The skills refer to the settings by name instead of a fixed number.
- **`settings.ts` owns the file;** `autonomy.ts` keeps the levels' rules. The dependency goes one way, from autonomy to settings.

## Consequences

- A project can use more review rounds or fewer parallel tasks without changing the plugin.
- The defaults are written down in one place (`settings.ts`), and the schema and the session context follow from it.
- Each new setting is a decision: it needs a default, bounds and a reason, so the settings stay few.

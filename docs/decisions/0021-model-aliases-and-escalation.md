# 21. Model aliases and escalation

Date: 2026-09-29

## Status

Accepted

Amends [ADR-0014](0014-model-routing.md) and [ADR-0015](0015-task-agents-and-model-overrides.md).

## Context

The first run of the `model-routing` checkup (2026-09-29) found two things the earlier ADRs didn't account for.

1. **Aliases lag behind Claude Code updates.** ADR-0014 says aliases like `sonnet` "follow new versions without edits". That is only true once Claude Code itself is updated. The Sonnet 5.5 alias needs Claude Code 2.1.284, and this machine ran 2.1.282, so `sonnet` still meant Sonnet 5.
2. **Fable 5.1 is a step up, not a default.** Anthropic positions it for "demanding reasoning and long-horizon agentic work, or when your evals on Claude Opus 5.5 at higher effort still fall short".

## Decision

- **Keeping aliases current:** aliases follow new models only after `claude update`. The `model-routing` checkup compares the installed Claude Code version with the aliases' version history, reports what each alias resolves to on this machine, and proposes an update when it would move an alias.
- **`fable` is not assigned to any task type.** It is the escalation target: when a task agent reports that its task is bigger than expected, work moves to `opus`, and to `fable` when `opus` at high effort still falls short. The session's model routing instructions say so.
- The checkup also reviews that escalation advice when new models appear.

## Consequences

- Model quality depends on keeping Claude Code updated, and the checkup makes that visible.
- `fable`'s higher cost is only paid when a cheaper model has demonstrably fallen short.

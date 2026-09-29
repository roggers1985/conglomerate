# 15. Task agents and model overrides

Date: 2026-09-29

## Status

Accepted. Amended by [ADR-0021](0021-model-aliases-and-escalation.md): `fable` is the escalation target when `opus` falls short.

Amends [ADR-0014](0014-model-routing.md): skills no longer set a model, and delegation goes through task agents.

## Context

ADR-0014 routes work to models by task type. The owner wants the agent to be able to deviate from that routing when a specific task calls for it, and wants the model list to stay current over time.

Under ADR-0014, task skills set `model` and `effort` in their frontmatter. That setting takes over whenever the skill is loaded, so Claude could not choose differently, not even when the owner asked. Claude Code's subagent definitions handle this better. A subagent's `model` and `effort` frontmatter are defaults, and a `model` passed when starting the subagent takes precedence over the default.

## Decision

### Task agents: defaults that can be overridden

- `bun run generate` creates one subagent per task type from `models.json`, in `plugins/factory/agents/tasks/<task>.md`, addressed as `factory:tasks:<task>`. Each carries its task's `model` and `effort`, and is never edited by hand. `bun run validate` fails when they are missing, stale or orphaned.
- Claude delegates through these agents. The session context says:
  - the table holds defaults;
  - Claude may override the model per call when a specific task clearly needs more or less, saying which model and why in one line;
  - the owner's choice always wins;
  - a task that turns out bigger or riskier than expected goes to a stronger model instead of being retried.
- Task agents are told to stop and report when their task is bigger or riskier than its type suggests, rather than pushing on.
- Only the model can be overridden per call. Effort always comes from the task agent's definition.

### Skills

- Skills still declare `metadata.task`, for the catalog and for dispatchers, but they **never** set `model` or `effort`. The validator enforces this.
- A skill invoked directly in the main session runs on the session model, which is the owner's choice.

### Keeping the list current

- Aliases (`opus`, `sonnet`, …) already follow new versions within a model family automatically.
- Everything else (new model families, retirements, changed prices, effort support, fit per task type) is covered by the **`model-routing` checkup** for this repository, which runs every 30 days and after model releases. It only proposes changes; the owner decides and applies them with `bun run generate`.
- There is no automatic sync that edits `models.json`, because model choices are the owner's decision.

## Consequences

- The routing is a strong default, not a cage. Deviations are visible, because Claude states them.
- Changing `models.json` only needs `bun run generate`. Skill files no longer need editing.
- Checkups now run with the `checkup` effort through their task agent. Running a checkup skill directly in the main session uses the session's model and effort.

# 14. Model routing

Date: 2026-09-29

## Status

Accepted

## Context

Different kinds of work suit different models. A cheap, fast model is fine for a rename. A careful, expensive one is worth it for architecture, reviews or marketing copy. The owner wants the agent to know which model fits which task, in one place that's easy to look up.

What Claude Code can do with a model choice:

- **The main session:** the owner chooses its model (`/model`). Claude cannot switch its own session model.
- **Skills:** a skill can set `model` and `effort` in its frontmatter. They apply while the skill is active, and when the skill runs in a subagent they set that subagent's model.
- **Subagents:** when Claude starts a subagent, it can choose the subagent's model.
- **Providers:** Claude Code runs only Claude models. Other providers would need an MCP server.

## Decision

- **`plugins/factory/models.json`** maps task types to `{ model, effort, use }`.
  - Task types: `code-small`, `code`, `code-complex`, `review`, `research`, `planning`, `writing`, `marketing`, `checkup`.
  - Models are **aliases** (`opus`, `sonnet`, `haiku`, `fable`), so they follow new model versions without edits.
  - Effort is one of `low` … `max`.
- **It is used in three places:**
  1. **Session context:** the startup hook adds the routing table to every session, so Claude knows which model to give a subagent. It also tells Claude that the session model is the owner's choice.
  2. **Skills that do a kind of work** (not reference material) declare `metadata.task`, and carry that task's `model` and `effort` in their frontmatter. `bun run validate` fails if they differ from `models.json`, or if a skill sets a model without a task type. Reference skills like `code-react` set no model, so loading them never switches models mid-turn.
  3. **Subagent dispatch:** the checkup runner starts each checkup's subagent with the `checkup` model. The factory stages will do the same.
- **The catalog** (`CATALOG.md`) shows each skill's task type and the full routing table.
- **No budget in dollars.** It can't be enforced in an interactive session. The effort level is the budget knob.
- **The initial assignments** (proposed by Claude, accepted by the owner):
  - `haiku`: mechanical edits (`code-small`).
  - `sonnet`: everyday coding, research, and checkups (long and frequent, so cost matters).
  - `opus`: complex code, reviews, planning, writing and marketing, where quality pays off the most.
  - `fable` is allowed but not assigned yet.

## Consequences

- Model choices live in one reviewed file. The `agent-setup` checkup should revisit them whenever a new model is released.
- The effort level a skill sets may not be supported by every model (for example the smallest ones). Claude Code then uses what the model supports.
- Changing a task's model in `models.json` means updating the frontmatter of that task's skills and regenerating the catalog. The validator lists every skill that needs updating.

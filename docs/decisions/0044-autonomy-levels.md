# 44. Autonomy levels

Date: 2026-09-30

## Status

Accepted

Amends [ADR-0008](0008-deliver-owner-conventions-through-the-plugin.md) (what the session-start hook adds) and [ADR-0043](0043-checkup-branches-as-pull-requests.md) (who merges checkup PRs).

## Context

Until now, `core.md` said the owner wants full control and to discuss every addition. The owner wants to be able to give more autonomy, either always or per session, so Claude can work on its own within the spirit of the plugin, and to turn it down when needed. What matters most to them is that the more autonomously Claude works, the more its work follows the conventions, the ADRs and their recorded preferences. They also want every choice to have a recommended option, which can be the default when Claude has a lot of autonomy.

Claude Code's permission modes decide which tool calls run without asking. They don't decide which *decisions* Claude makes without asking, so that needs a setting of its own.

## Decision

- **Three levels:**
  - `guided`: the owner decides and Claude proposes. This was the behaviour so far.
  - `trusted`: Claude decides within the conventions and reports afterwards. It asks about anything beyond them: a new dependency, tool, skill, hook or agent, a change in scope, or a choice that comes down to taste. It may merge checkup PRs that hold only fixes.
  - `autonomous`: Claude runs the work end to end on its recommended options, and the owner reviews afterwards. Decisions become ADRs with status **Proposed**, for the owner to accept or reject. Claude merges its own work after green checks and a `review` agent without high or medium findings. It works within limits: at most 10 subagents per task and 3 attempts per failing check. When it reaches a limit, it stops and reports.
- **Every level:**
  - act in the spirit of the plugin;
  - always have a recommended option with its reason. At `trusted` and `autonomous`, Claude acts on it and records the choice, the alternatives and why. When no option can be recommended from the conventions, the ADRs or the owner's recorded preferences, the choice is the owner's at every level.
- **Always the owner's, at every level:**
  - changing the conventions or an accepted ADR;
  - exceptions to the license policy;
  - anything destructive or irreversible;
  - production and secrets;
  - paid services;
  - making anything public.
- **Where the level is set:**
  - the default is `guided`;
  - a project sets its own in `.claude/factory.json`, which is our own format and parsed strictly;
  - `/factory:autonomy <level>` changes it for the rest of a session, and `--save` also writes it to the project file;
  - an invalid settings file falls back to `guided`, with the reason, so a typo never grants more autonomy;
  - Claude never raises the level itself.
- **Delivery:** the session-start hook adds the level's rules (`conventions/autonomy/<level>.md`) after the core conventions. The universal rules and the owner-only list are in `core.md`.
- **Separate from permission modes:** the factory never changes the permission mode. `/factory:autonomy` warns when the mode doesn't suit the level.
- **This repository runs at `trusted`.**
- **Later, tracked in `TODO.md`:**
  - per-stage levels in Stage 0 triage;
  - hooks that enforce what can be enforced.

## Consequences

- The same plugin supports the owner's wish for full control in one project and more autonomy in another.
- The levels are instructions until the enforcing hooks exist, so a model can overstep them. The owner-only list, recorded choices and Proposed ADRs make that visible afterwards.
- The domain list gains `autonomy` (ADR 0013), so the skill is invoked as `/factory:autonomy`.

---
name: autonomy
description: Shows or changes how much Claude decides without asking (guided, trusted or autonomous), for this session or for the project. Use for "/factory:autonomy", when the owner asks to work more or less autonomously, or asks what the current autonomy level is. Only the owner changes the level.
argument-hint: "[guided | trusted | autonomous] [--save]"
---

# Autonomy

The autonomy level decides how much you decide without asking (ADR 0044). The session started at the level in the "Autonomy" section of the conventions, which comes from the project's `.claude/factory.json` (default `guided`). What `core.md` says for every level still holds, above all: act in the spirit of the plugin, always have a recommended option, and leave what is always the owner's to the owner.

| Level | In short |
|---|---|
| `guided` | The owner decides; you propose, and build what was agreed. |
| `trusted` | You decide within the conventions and report afterwards; you ask for what goes beyond them. You may merge checkup PRs that hold only fixes. |
| `autonomous` | You run the work end to end on your recommended options, within limits, and the owner reviews afterwards. New ADRs are written as Proposed. |

The full rules of each level are in `${CLAUDE_PLUGIN_ROOT}/conventions/autonomy/<level>.md`.

## What to do, based on the arguments: `$ARGUMENTS`

- **No arguments:** say which level this session runs at and where it comes from (the conventions' "Autonomy" section, or a change made earlier in this session), and show the table above.
- **A level:** only when the owner asked for it; never change the level on your own initiative, and never raise it because a task would be easier.
  1. Read `${CLAUDE_PLUGIN_ROOT}/conventions/autonomy/<level>.md` and follow it for the rest of this session, instead of the level the session started with. Say so in one line.
  2. Check that the session's permission mode fits: at `autonomous`, a mode that asks before every edit or command will keep interrupting the work. If it doesn't fit, say which mode would (e.g. accept edits, or auto), but don't change it: permission modes are the owner's.
- **A level with `--save`:** also set `"autonomy": "<level>"` in the project's `.claude/factory.json`, keeping its other settings, so later sessions start at it. Commit that change like any other, and push it.

- **Anything else:** say which arguments are accepted, and change nothing.

The same file holds the project's limits (review rounds, parallel tasks, attempts, subagents; ADR 0058). Its schema is `${CLAUDE_PLUGIN_ROOT}/schemas/factory.schema.json`: point the file's `"$schema"` at it so an editor validates and completes it.

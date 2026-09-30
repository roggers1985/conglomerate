---
name: checkup-agent-setup
description: Agent setup checkup. Checks that the project's Claude Code setup (CLAUDE.md, skills, settings, permissions, hooks, checkup schedule) is accurate, concise and effective, and finds relevant new Claude Code features. Use for "agent setup checkup", "is our CLAUDE.md any good", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: agent-setup

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

The agent's instructions decay like code. This checkup keeps them short, correct and useful. Whether they still *match the code* is also covered by **docs-drift**; this checkup is about how well they work.

## In scope

1. **`CLAUDE.md`** (and nested ones, `AGENTS.md`):
   - concise, with long procedures moved into skills;
   - no contradictions with each other, with the factory plugin's conventions, or with the owner's global `~/.claude/CLAUDE.md`. Read that file from disk (your context may hold an outdated copy), and report duplicates that could be removed now the plugin provides them.
2. **Skills** (`.claude/skills/`):
   - descriptions that say *when* to use them ("Use when …"), so they trigger;
   - no overlapping skills, and none unused for a long time;
   - old `.claude/commands/` files that should become skills.
3. **Settings** (`.claude/settings.json`; a project without one is fine, not a finding):
   - permission rules no broader than needed (no blanket `Bash(*)`), and deny rules for dangerous commands;
   - hooks that point at existing scripts and still work (run them);
   - configured MCP servers that are still used.
4. **Checkup schedule**: checkups that no longer fit, missing ones (make the same judgement the runner makes in its step 2: UI, public site, personal data, database, …), and intervals that seem wrong given past reports.
5. **Toolbox** (`toolbox.json` in the factory plugin, ADR 0033): tools and plugins with security advisories, new major versions or no recent maintenance; entries whose permissions changed (re-run `claude plugin details`); and useful new tools or plugins, proposed with the full security record from the `toolbox` skill.
6. **New Claude Code features**: read the Claude Code changelog since the previous report. List features relevant to this project (hook events, skill options, settings).

## Fixes you may make yourself

- Fix wording, broken paths and hooks, and outdated statements in `CLAUDE.md` and skills.

## Allowed production access

None.

## Always "Needs a human"

- Permission changes, removing rules or skills, and edits to the owner's global `~/.claude/CLAUDE.md` (propose them; never edit files outside the project).

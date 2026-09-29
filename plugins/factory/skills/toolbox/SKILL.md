---
name: toolbox
description: The owner's toolbox of trusted command-line tools and Claude Code plugins. Shows which are missing on this machine and proposes how to install them (never installs without confirmation), and handles proposals to add a new tool or plugin, each with a security record. Use when the session-start notice says something is missing, when asked about installed tools or plugins, or when considering a new tool or plugin.
allowed-tools: Bash(bun "${CLAUDE_PLUGIN_ROOT}/dist/toolbox.js" *)
---

# Toolbox

The owner's trusted tools and plugins are listed in `${CLAUDE_PLUGIN_ROOT}/toolbox.json`, each with a security record: source, license, how it's installed, and what it's allowed to do (ADR 0033).

## Current state

!`bun "${CLAUDE_PLUGIN_ROOT}/dist/toolbox.js" status`

## Installing what's missing

1. Show the table above, and for each missing entry its purpose and its install command.
2. **Install nothing without the owner's explicit confirmation, per tool.** Install in dependency order (an entry's `requires` first). After installing, run the tool's version command (or `claude plugin details <id>` for a plugin) to confirm it works.
3. Commands that need the owner's own terminal (logins like `gh auth login`) are given as `! <command>` for the owner to run.

## Adding a tool or plugin

Never add a tool or plugin in passing. Propose it, with this security record, built from primary sources, not from memory:

| Field | Check |
|---|---|
| Source | The official homepage and repository; who maintains it; is it actively maintained (recent releases, open issues handled)? |
| Install method | Prefer a package manager with verified packages (Homebrew) or the official installer; never a script from an unofficial source. Pin a version where the tool is critical. |
| License | Compatible with how the owner uses it (see the `licenses` checkup). |
| Permissions | What it can do: hooks that run on every command or prompt, MCP servers with network or file access, credentials it needs. Plugins: run `claude plugin details <id>` and list their hooks, agents and MCP servers. |
| Security history | Known advisories or incidents. |
| Overlap | Does it duplicate a tool or plugin already in the toolbox? |

Once the owner approves:
- add the entry to `toolbox.json` in the factory repository (`~/Projects/js/conglomerate`);
- run `bun run generate` and `bun run check`;
- commit with the security record in the message.

Removing an entry follows the same route.

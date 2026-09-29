# 24. Local marketplace installation

Date: 2026-09-29

## Status

Accepted

## Context

To use the factory in other projects (starting with jobs), the plugin must be installed. There were two options: a GitHub remote for this repository, or a local marketplace pointing at the folder on this machine. The owner chose local.

## Decision

- This repository is registered as a local marketplace (`claude plugin marketplace add ~/Projects/js/conglomerate`), and `factory@conglomerate` is installed at user scope, so it is active in every project.
- The conventions the plugin provides were removed from the owner's global `~/.claude/CLAUDE.md`, which now only points to the plugin and keeps the RTK instructions. The previous version is kept as `~/.claude/CLAUDE.md.before-factory-plugin`.
- **Updating after changes:**
  1. `bun run check`;
  2. commit;
  3. `claude plugin marketplace update conglomerate`;
  4. `claude plugin update factory@conglomerate`;
  5. restart Claude Code sessions.

  Whether the plugin's `version` must be raised for an update to be picked up is still to be verified (tracked in `TODO.md`).
- Moving to a GitHub remote later needs no change to the plugin itself.

## Consequences

- Every Claude Code session on this machine gets the factory's conventions, routing table, checkup reminder and skills. The overview (`claude plugin details`) puts the always-on cost at about 2,650 tokens of skill descriptions, plus the conventions added at session start.
- React and testing conventions, which were always loaded from the global file, now load on demand through their skills (as intended by ADR 0008).
- The plugin only works on this machine until the repository has a remote.

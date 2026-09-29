# 33. Toolbox of trusted tools and plugins

Date: 2026-09-29

## Status

Accepted

## Context

The owner relies on tools that make the agent work better (RTK for token savings, `gh`, Bun and others) and on a few Claude Code plugins. They want these to be present on every machine and in every session, without blindly installing things: every tool must be secure, and some are powerful. RTK, for example, rewrites every shell command through a hook.

## Decision

- **`plugins/factory/toolbox.json` lists the trusted tools and plugins.** Each entry has a security record:
  - purpose;
  - how to check it's present, and how to install it;
  - official source;
  - license;
  - permissions (what it's allowed to do);
  - which other entries it requires.

  The schema is strict and bounded (ADR 0020, 0032, 0034), and requirements must refer to entries in the toolbox.
- **A session-start hook (`dist/toolbox.js reminder`) reports what's missing,** in one quiet line, and tells Claude not to bring it up or install anything unasked. It checks quickly and locally: tools on the `PATH`, plugins in `~/.claude/settings.json`. There are no network or version calls.
- **The `toolbox` skill (`/factory:toolbox`)** shows the state and proposes install commands in dependency order. **It installs nothing without the owner's explicit confirmation, per tool.**
- **Adding or removing an entry is always a proposal,** with the security record built from primary sources:
  - source and maintenance;
  - install method;
  - license;
  - permissions (`claude plugin details` for plugins);
  - security history;
  - overlap with existing entries.

  The owner approves before `toolbox.json` changes.
- **The `agent-setup` checkup reviews the toolbox periodically:** advisories, abandoned tools, changed permissions, and good new candidates.
- **A new skill domain, `toolbox`,** is added to the naming rules (ADR 0013) for this skill.
- **Initial contents:** `rtk`, `jq`, `gh`, `bun`, `uv` and `gopls`, and the plugins `factory`, `code-simplifier`, `frontend-design`, `security-guidance` and `gopls-lsp`. At the owner's request, a duplicate `frontend-design` (from a second marketplace) and the unused `superpowers` plugin were uninstalled.

## Consequences

- A new machine, or a removed tool, shows up in the next session, with the install commands ready.
- Nothing is installed or trusted silently: the list is reviewed like code, and each install is confirmed.
- Tool versions are not pinned or checked at session start. Outdated versions are the `agent-setup` and `outdated-packages` checkups' job.

# 8. Deliver the owner's conventions through the plugin

Date: 2026-09-29

## Status

Accepted

## Context

The owner keeps personal conventions (code style, React, testing) in their global `~/.claude/CLAUDE.md`. The factory is personal and opinionated (ADR-0007), so these conventions belong in the plugin, where they are versioned and travel with it.

A plugin cannot ship a `CLAUDE.md`. It has two other ways to get instructions to Claude:

- **Hooks**: a `SessionStart` hook can inject text into every session. This is reliable, but the text costs context in every session.
- **Skills**: Claude loads a skill only when its description matches the task. This is cheap and portable (Copilot also reads skills), but Claude may fail to load a skill when it should.

## Decision

We use a hybrid:

- **Core conventions** (code style, "always add tests") live in `plugins/factory/conventions/core.md`. A `SessionStart` hook (`scripts/session-start.ts`) injects them into every session, including after `/clear` and compaction.
- **Topic conventions** are skills that load when relevant:
  - `skills/react-conventions/`: React and UI
  - `skills/testing-conventions/`: Testing Library, and testing behavior rather than implementation
- The core file points to the topic skills, so Claude knows they exist.
- The owner's global `~/.claude/CLAUDE.md` stays unchanged until the plugin has proven itself. The owner removes the duplicates by hand.

## Consequences

- Core rules apply in every project where the plugin is enabled, without depending on Claude to load a skill.
- React rules don't take up context in projects that aren't React projects.
- While the global file still has the same rules, they are loaded twice. That is harmless, but the two copies can drift apart, so they should be removed from the global file once the plugin is in use.
- A new convention goes in `core.md` only if it applies to every task. Anything else becomes a skill.

---
name: checkup-claude-code-platform
description: Claude Code platform checkup for the factory plugin. Compares what the plugin uses (manifests, hooks, skill and agent frontmatter, environment variables) with Claude Code's current plugin platform, and finds new features, deprecations and breaking changes. Also tracks whether GitHub Copilot can run the plugin's skills. Use for "platform checkup", "is the plugin up to date with Claude Code", after Claude Code releases, or when the checkup runner dispatches it.
metadata:
  task: checkup
---

# Checkup: claude-code-platform

Follow the protocol in `plugins/factory/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

The factory is built on Claude Code's plugin platform. This checkup keeps the plugin working on it, and finds features that would simplify it. The general agent setup of *projects* is the generic **agent-setup** checkup's job; model choices are **model-routing**'s.

## Primary sources

- Claude Code changelog: https://code.claude.com/docs/en/changelog (or the `CHANGELOG.md` in the `anthropics/claude-code` repository)
- Plugins and plugin reference: https://code.claude.com/docs/en/plugins and https://code.claude.com/docs/en/plugins/manifest-reference
- Hooks: https://code.claude.com/docs/en/hooks
- Skills: https://code.claude.com/docs/en/skills
- Subagents: https://code.claude.com/docs/en/sub-agents
- GitHub Copilot customisation (skills, agents, instructions): GitHub's documentation on Copilot agent skills and custom agents

If a page has moved, find it through https://code.claude.com/docs/llms.txt, and note the new URL under "Next time".

The changelog pages only show the last week or two. For older versions, read the release history by version range: `gh release list -R anthropics/claude-code` and `gh release view <tag> -R anthropics/claude-code`, or the `CHANGELOG.md` at a given tag.

## In scope

1. **What changed**: read the changelog since the Claude Code version in the previous report (on a first run, the last three months). List changes that affect plugins: manifest fields, hook events and output fields, skill and subagent frontmatter, environment variables (`CLAUDE_PLUGIN_ROOT`, …), marketplace behaviour.
2. **What the plugin uses**, checked against the current documentation:
   - `.claude-plugin/marketplace.json`, `plugins/factory/.claude-plugin/plugin.json`;
   - `plugins/factory/hooks/hooks.json`: the `SessionStart` hook, `systemMessage` and `hookSpecificOutput.additionalContext`;
   - skill frontmatter (`metadata`, `argument-hint`, `allowed-tools`) and `` !`command` `` injection in the runner skill;
   - the generated task agents' frontmatter (`model`, `effort`);
   - `claude plugin validate plugins/factory`.
3. **Deprecations and breaking changes** that affect any of the above, with the version they take effect in.
4. **Opportunities**: new platform features that would replace a workaround in this repository, such as the bundling of plugin scripts (ADR 0020), the session-start hook, or the task agents (ADR 0015).
5. **Copilot**: whether GitHub Copilot can now use the plugin's skills or agents (TODO: "Copilot can be integrated later"). Report what would be needed; don't build it.

## Fixes you may make yourself

- Small compatibility fixes that keep behaviour the same (a renamed field, a changed output format), with `bun run check` and `claude plugin validate` passing.
- Outdated URLs in this skill file.

## Allowed production access

None.

## Always "Needs a human"

- Adopting a new platform feature, and anything that changes how the plugin behaves or is structured. Such changes need an ADR.

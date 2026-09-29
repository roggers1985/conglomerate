---
name: checkup
description: Run the project's recurring checkups (dependencies, security, code and frontend quality, tests, docs, accessibility, and project-specific ones like legal). Shows which are due according to docs/checkups/checkups.json and runs the chosen ones, priority first. Use when asked to "run the checkups", "do a checkup", or to see which checkups are due or overdue.
argument-hint: "[due | all | <name>…]"
allowed-tools: Bash(bun "${CLAUDE_PLUGIN_ROOT}/scripts/checkups.ts" *)
---

# Checkup runner

You coordinate the project's recurring checkups (see ADR 0010 in the factory plugin). Each checkup is its own skill, `checkup-<name>`, and follows the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md`.

## Current status

!`bun "${CLAUDE_PLUGIN_ROOT}/scripts/checkups.ts" status "${CLAUDE_PROJECT_DIR}"`

This status is computed from `docs/checkups/checkups.json` and the report dates. Don't recompute it.

## Steps

1. Show the status table above to the user.
   - If no checkups are scheduled, explain how to start: create `docs/checkups/checkups.json` with entries like `{ "name": "outdated-packages", "intervalDays": 30, "priority": false }`, and list the plugin's `factory:checkup-*` skills as candidates. Stop there.
2. Decide what to run, based on the arguments: `$ARGUMENTS`
   - Checkup names: run those.
   - `all`: run every scheduled checkup.
   - `due`, or nothing: run the due ones, but ask for confirmation first.
3. Order: priority checkups first, then the rest in schedule order.
4. For each chosen checkup, find its skill: `factory:checkup-<name>` (from the plugin) or `checkup-<name>` (from the project's `.claude/skills/`). If neither exists, report that and skip it.
5. Run the checkups **one at a time, each in its own subagent** (Agent tool), so each starts with a clean context. Use the task agent `factory:tasks:checkup`, which defaults to the `checkup` model and effort from `models.json`. Override the model only when the user asks for one (e.g. "run the checkups with opus"). Tell each subagent:
   - to invoke the checkup's skill;
   - to follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md`;
   - today's date, so the branch and report are named consistently.
6. When all are done, reply with one line per checkup: branch or PR link, and the single most important finding.

## Rules

- Don't do the checkups' work yourself. Your job is choosing and dispatching.
- If a checkup fails, report why and continue with the next one.
- Never change `intervalDays` or `priority` unless the user asks.

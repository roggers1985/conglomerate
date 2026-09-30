---
name: checkup
description: Run the project's recurring checkups (dependencies, security, code and frontend quality, tests, docs, accessibility, and project-specific ones like legal). Shows which are due according to docs/checkups/checkups.json and runs the chosen ones, priority first. Use when asked to "run the checkups", "do a checkup", or to see which checkups are due or overdue.
argument-hint: "[due | all | <name>…]"
allowed-tools: Bash(bun "${CLAUDE_PLUGIN_ROOT}/dist/checkups.js" *), Bash(git branch --list *), Bash(git worktree remove *), Bash(git branch -d *)
---

# Checkup runner

You coordinate the project's recurring checkups (see ADR 0010 in the factory plugin). Each checkup is its own skill, `checkup-<name>`, and follows the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md`.

## Current status

!`bun "${CLAUDE_PLUGIN_ROOT}/dist/checkups.js" status "${CLAUDE_PROJECT_DIR}"`

This status is computed from `docs/checkups/checkups.json` and the report dates. Don't recompute it.

Unmerged checkup branches (their reports don't count yet):

!`git branch --list 'checkup/*' --format='%(refname:short)'`

## Steps

1. Show the status table above to the user.
   - If no checkups are scheduled, explain how to start: create `docs/checkups/checkups.json` with entries like `{ "name": "outdated-packages", "intervalDays": 30, "priority": "normal" }` (`priority` is `urgent`, `normal` or `quiet`, ADR 0030), and propose a starting schedule from the plugin's `factory:checkup-*` skills that fit this project (see step 2). Stop there.
   - If a checkup's skill is **missing**, say so: it can't run until the project adds `.claude/skills/checkup-<name>/SKILL.md` or the name is corrected.
2. Look for checkups the project is missing, skipping those listed as declined under the table. Check the project briefly (structure, `package.json`, pages, config) and suggest, without adding them yourself:
   - generic ones from the plugin that fit but aren't scheduled, e.g. `frontend-quality`, `accessibility` and `performance` when there is a UI, and `seo` for a public website;
   - project-specific ones, which the project writes as its own skills: `legal` or `privacy` when there are terms, a privacy page, cookies or personal data; data quality when there is a database with imported or user-generated data; `backups` when there is production data; `analytics` when there is tracking; content freshness when the site states facts that expire (prices, laws, figures);
   - `monitoring` (daily, urgent) when the project uses monitoring or scanning services: SonarQube, Veracode, Sentry, Snyk, GitHub code scanning or Dependabot alerts, Datadog, and similar;
   - and scheduled checkups that no longer fit the project.
   - **Opting out and back in:** when the owner declines a checkup (now, or at any time), remove it from `checkups` and add its name to `declined` in the schedule, so it isn't suggested again. When they opt back in, move it back with its settings. Change the schedule only on the owner's explicit request.
3. Decide what to run, based on the arguments: `$ARGUMENTS`
   - Checkup names: run those.
   - `all`: run every scheduled checkup.
   - `due`, or nothing: run the due ones, but ask for confirmation first.
4. Order: `urgent` checkups first, then `normal`, then `quiet`; within a level, schedule order.
5. For each chosen checkup, use the skill in the table's Skill column: the project's own `checkup-<name>` (from `.claude/skills/`) when it says `project` (it overrides the plugin's version), otherwise the plugin's `factory:checkup-<name>`. Skip checkups whose skill is missing, and say so.
6. Run **interactive checkups** (`metadata.interactive: true` in the skill's frontmatter, such as `monitoring`) first, yourself, in this session with the owner, following their skill. Then run the others **one at a time, each in its own subagent** (Agent tool), so each starts with a clean context, and **each in its own worktree** (`isolation: "worktree"`), so a checkup never switches branches or edits files in this session's checkout (ADR 0042). Before the first one, check that `.claude/worktrees/` is in the project's `.gitignore`; if it isn't, propose adding it and wait for the owner. Use the task agent `factory:tasks:checkup`, which defaults to the `checkup` model and effort from `models.json`. Override the model only when the user asks for one (e.g. "run the checkups with opus"). Tell each subagent:
   - that it runs in a worktree under `.claude/worktrees/`, and must first create its branch there from the **local** default branch (`git switch -c checkup/<name>-<today> <default branch>`): the worktree itself starts from the remote's default branch, which can be behind;
   - to read the checkup's skill from disk after switching, because the skill list it started with comes from the worktree's first checkout: `.claude/skills/checkup-<name>/SKILL.md` for a project skill, `${CLAUDE_PLUGIN_ROOT}/skills/checkup-<name>/SKILL.md` for the plugin's;
   - to follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md`;
   - today's date, so the branch and report are named consistently;
   - the unmerged checkup branches listed above, copied exactly, never retyped or counted by hand;
   - whether the repository has a remote, and whether `gh` is logged in (for the protocol's hand-over step).
7. **After each subagent**, remove its worktree once its work is committed on its checkup branch: `git worktree remove <path>`, then delete the worktree's own branch (`worktree-<name>`) with `git branch -d`. Keep the checkup branch. If the removal refuses because of uncommitted changes, leave the worktree, and name its path in your reply.
8. When all are done, reply with one line per checkup: branch or PR link, and the single most important finding.

## Rules

- Don't do the checkups' work yourself. Your job is choosing and dispatching.
- If a checkup fails, report why and continue with the next one.
- Never change `intervalDays` or `priority` unless the user asks.

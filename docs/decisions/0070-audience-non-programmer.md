# 70. An audience setting for non-programmers

Date: 2026-11-23

## Status

Proposed. It becomes accepted when the owner merges the pull request that adds it.

Amends [ADR-0044](0044-autonomy-levels.md) (the autonomy level is not the only setting about who decides) and [ADR-0058](0058-project-settings.md) (a new key in `.claude/factory.json`). Extends [ADR-0069](0069-guard-hook-for-owner-only-actions.md): the guard denies instead of asking.

## Context

Non-programmers will work in a project, the first being the tuygo frontend. The owner cannot take risks with money, data, authentication or deploys. Waiting for the owner on every technical or permission question would block the non-programmers, and they cannot answer such questions anyway. The autonomy levels say how much Claude decides; none says who is at the keyboard.

## Decision

- **A new setting, `audience`, in `.claude/factory.json`:** `owner` (the default) or `non-programmer`. It is a role, not a fourth autonomy level: the level says how much is decided without asking, the audience says who is at the keyboard and what they can answer. The two combine.
- **The session context says it.** With `audience: non-programmer` the autonomy part of the session-start context adds a short section that points to the new skill `factory-non-programmer`. With the default it adds nothing, so the owner's sessions cost nothing extra.
- **The skill `factory-non-programmer`** holds the behaviour (`plugins/factory/skills/factory-non-programmer/SKILL.md`):
  - only questions about what people see and do, in plain language;
  - technical decisions go to a `code-complex` subagent and into `docs/handoff.md`, so the owner can review them;
  - commit messages and pull request descriptions in plain language, with the technical part at the end;
  - an item on the owner-only list does not stop the work: Claude records it in the handoff file as "Needs owner review", takes the safe side, and carries on. The pull request lists the open items.
- **The guard denies what the owner would be asked.** For this audience `guard.js` refuses, instead of asking: a force-push, a push to `main` or `master`, any `gh pr merge`, an edit to an accepted ADR, and an edit to `.claude/factory.json` or `.claude/settings*`, so a session cannot raise its own level or change its own audience.

## What stays outside this plugin

These are properties of a project and its host, not of the plugin. The owner sets them up in each project before a non-programmer starts, and they are tracked in `TODO.md`:

- Git guardrails: no direct pushes to `main` on the host (branch protection), the owner approves every merge, and a `CODEOWNERS` file for sensitive paths, `package.json`, lockfiles and the settings files.
- Permission rules in the project's settings that deny edits outside the frontend paths.
- No production credentials, secrets or paid services in the environment: a sandbox with fake data.
- For the tuygo API: how the frontend gets the API's contract (OpenAPI and generated types).

The guard is a net inside the session, not a replacement for these: a person at a terminal can still run a command the guard does not read.

## Alternatives considered

| Option | Why not |
|---|---|
| A fourth autonomy level, `guided-plain` | It mixes two things. A non-programmer may need `trusted` behaviour with plain language, and the owner may want plain language at `guided` |
| Put the behaviour in `core.md` | Every session would pay for it. A skill loads only when the audience is set |
| Ask the non-programmer to approve the owner-only items | They cannot judge them, and a click-through approval hides the risk |

## Consequences

- One new key in the settings schema (regenerated into `schemas/factory.schema.json`), one skill (about 40 skills in the list), and a few lines in the guard.
- The owner reviews decisions at the pull request instead of during the work. That needs the handoff file to be read: the pull request description lists the open items, so it is hard to miss.
- A non-programmer cannot unblock a denied action themselves. That is the point; the owner can, from their own session.

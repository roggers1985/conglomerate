# 67. Process scales with size and risk

Date: 2026-11-23

## Status

Proposed. It becomes accepted when the owner merges the pull request that adds it.

Amends [ADR-0051](0051-stage-0-triage.md) (triage runs only above a small, low-risk task), [ADR-0063](0063-tests-written-apart-from-the-code.md) (separate test and code agents only on the full track or at high risk) and [ADR-0055](0055-review-and-security-review.md) (one review round unless the route is full or high risk). Leaves [ADR-0058](0058-project-settings.md) as it is: `reviewRounds` still sets the limit for the full track.

## Context

The stages, agents and always-on text cost many tokens on every task, small ones too. The session-start context is about 12 KB of conventions, autonomy rules and routing, plus about 17 KB of skill descriptions (measured 2026-11-23): roughly 7,000 tokens before the first word of a task. A one-line fix went through the same triage, test agent, code agent and review rounds as a migration.

The owner asked for a short always-on core and process that scales with size and risk, with little as the default (`TODO.md`, "Less ceremony").

## Decision

Three tiers. They reuse the tracks of ADR 0051; no new track is added.

| Tier | Task | Process |
|---|---|---|
| Small | A fix, a tweak or a visual change that is small, low risk, reversible, has low uncertainty and adds no entry point | No triage and no pipeline: do it, run the project's checks, report. If it grows, stop and triage |
| Medium | A feature: the `standard` track (or `quick` when triage chooses it) | Triage. One agent writes the tests and the code, test-first. One review round |
| Large or risky | The `full` track, or any route whose risk is high (money, authentication, data, migrations, architecture) | The full pipeline: a test agent, a code agent, an arbiter for a disputed test, and up to `reviewRounds` review rounds |

- **Entry points are never small** (ADR 0057): a change that adds or changes one gets triage and at least the standard track, as before.
- **The test and code agents are split on the full track or at high risk.** On a medium route, one agent writes the tests first and then the code; the review's mutation check (ADR 0063) still shows that each test can fail, so a test that only restates the code is found there.
- **One review round on a medium route.** Findings are fixed, and the reviewer checks the fixes only for high findings. Several rounds remain for the large tier.
- **The gates do not change.** The route check, the spec and plan gates and the evidence per criterion stay as they are on the standard and full tracks. Making them optional is a separate decision, to be taken after a first real change shows what they cost.

## Alternatives considered

| Option | Why not |
|---|---|
| Drop the quick track and call it small | A quick route still writes a record and a review. Triage may still choose it; the small tier is only for work that needs neither |
| Keep the agent split on every standard route | It is the most expensive part of a build (two or three subagents per task) and a medium feature is not what it was added for (ADR 0063: tests that repeat a misread spec). The mutation check covers the same risk more cheaply |
| Make the evidence gates optional now | It changes the gate scripts and the templates. Better judged with real data |

## Consequences

- A small change costs what it did before the factory existed. The risk is that a task is judged small and is not: the rule says to stop and triage when it grows, and a task that adds an entry point is never small.
- A medium change builds with one agent per task and one review round, so it costs about a third of the subagents it did.
- `core.md` and three skills (`factory-triage`, `factory-build`, `factory-review`) carry the new rules; no script changes.

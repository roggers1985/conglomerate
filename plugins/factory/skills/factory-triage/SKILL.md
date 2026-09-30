---
name: factory-triage
description: Stage 0 of the factory. Classifies a new task (type, size, risk, reversibility, uncertainty, architecture debt), proposes a route through the factory's stages with an autonomy level per stage, and writes it down once the owner confirms, so an interrupted session can resume. Use at the start of every new task the owner gives (unless they say "no triage"), for "/factory:start", when a stage turns out bigger or riskier than planned (re-triage), or to resume an unfinished change.
metadata:
  task: planning
---

# Triage

Every new task starts here (ADR 0051). Triage decides *how* the task goes through the factory, not *what* gets built: that's the stages' work. The owner can skip it by saying "no triage".

## 1. Classify

Look at the task and, briefly, at the code it touches. Decide each of these, with a word of reason:

| | Values |
|---|---|
| **Type** | feature, bug, refactor, chore, docs, spike |
| **Size** | small (a few files in one module), medium (several modules, one unit), large (several units, or new concepts) |
| **Risk** | low; moderate; high (data, money, security, authentication, a public API, production) |
| **Reversible** | yes; no (migrations, deletions, public API changes, anything published) |
| **Uncertainty** | low (the solution is clear); high (it isn't: needs a spike) |
| **Architecture debt** | the open entries in `docs/architecture/` (ADR 0045) that the task touches, if any |

## 2. Choose a track

The table is fixed, so the same task always gets the same route:

| Track | When | Stages |
|---|---|---|
| **quick** | small, low risk, reversible, low uncertainty | build (test-first) → verify → review |
| **standard** | medium, *or* moderate risk | spec → plan → build → review → finish |
| **full** | large, *or* high risk, *or* not reversible, *or* spanning several units | intent → spec → plan → tasks → build → review → docs → finish |

When two rows fit, take the heavier track.

## 3. Adjust the route

A route is a list of stages from a fixed set, in a fixed order: intent, spec, spike, architecture, migration-plan, plan, tasks, build, verify, security-review, review, docs, finish. The track is only the starting point. Every deviation is allowed if it has a reason, recorded in `deviations`:

- **+ spike** when uncertainty is high;
- **+ architecture** when the task touches open architecture debt: assess whether to fix it first (ADR 0045);
- **+ migration-plan** for schema or data changes;
- **+ security-review** for authentication, secrets or untrusted input;
- **+ verify** on the standard or full track when the result can only be checked by running it;
- **intent and spec combined** (drop intent) when the owner has already stated the problem clearly;
- anything the owner asks for when confirming.

The recorded deviations show over time whether a new track is needed; the `retro` checkup looks at them.

## 4. Autonomy per stage

- Each stage starts at the session's autonomy level (the conventions' "Autonomy" section, or `/factory:autonomy`).
- **intent and spec always run at `guided`:** what to build is the owner's.
- On the **full** track, every stage runs at `guided` unless the owner raises it when confirming.
- You may propose a higher level for a stage, but it only takes effect with the owner's confirmation.

## 5. Propose, and wait

Show the owner, in a few lines: the classification, the track, the deviations with their reasons, and the level per stage. Recommend it; don't list alternatives neutrally. **Wait for the owner's confirmation at every autonomy level:** the route sets the levels, so it is the owner's. They may change the track, add or drop stages, or change a level.

## 6. Write it down

- **quick:** no files. Write the route as one line in your reply, e.g. "Route: quick (build → verify → review), trusted", and start.
- **standard and full:** create `docs/changes/<YYYY-MM-DD>-<short-name>/task.md`, then check it with `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check <path>`. Fix it until the check passes, then commit it.

```markdown
---
title: Export jobs as CSV
created: 2026-10-01
track: standard
classification:
  type: feature
  size: medium
  risk: low
  reversible: true
  uncertainty: low
  architectureDebt: []
stages:
  - { name: spec, level: guided, status: pending }
  - { name: plan, level: trusted, status: pending }
  - { name: build, level: trusted, status: pending }
  - { name: security-review, level: trusted, status: pending }
  - { name: review, level: trusted, status: pending }
  - { name: finish, level: trusted, status: pending }
deviations:
  - "+ security-review: the export includes personal data"
---

# Export jobs as CSV

Why this route, in a few sentences. Notes for resuming go here as the work goes on.
```

Keep `task.md` current as the work goes on: set a stage to `in-progress` when you start it and to `done` when it's finished, and commit that. The stage documents (`intent.md`, `spec.md`, `plan.md`, `tasks.md`) go next to it.

## Re-triage

Any stage stops and proposes a new route when the task turns out bigger or riskier than classified: it touches another unit, many more files than planned, or reveals a risk. Update the classification, the route and the deviations (with the reason for the change), check the file, and wait for the owner again.

## Resuming

At session start, the factory reports unfinished changes. When the owner wants to resume one, read its `task.md`, continue at the stage in progress (or the first pending one), at that stage's level.

## The stages themselves

- **intent** and **spec:** the `factory-intake` skill (ADR 0052).

The other stages are being built one at a time (`TODO.md`). Until a stage's own skill exists, do its work as the route describes, following the conventions, and say that the stage has no skill yet.

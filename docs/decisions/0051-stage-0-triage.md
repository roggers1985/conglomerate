# 51. Stage 0: triage

Date: 2026-09-30

## Status

Accepted

Extends [ADR-0044](0044-autonomy-levels.md) (autonomy per stage) and [ADR-0045](0045-architecture-checkup-and-register.md) (architecture debt in triage).

## Context

The factory's stages (intent, spec, plan, tasks, build, review, docs, finish) are the part every alternative is built around, and the factory's biggest gap (`docs/readiness.md`). They start with triage: deciding how a task goes through them. Not every task needs every stage, and a fixed path would either burden small tasks or under-protect risky ones. Triage also has to take into account:
- the autonomy level per stage;
- open architecture debt;
- resuming an interrupted session;
- Anthropic's AI-native SDLC playbook, which puts a human gate at intent and spec, at the plan, and at the pull request.

The owner asked whether a dynamic track would make sense, and had no experience yet to judge whether it's needed.

## Decision

- **Triage classifies** each new task by type, size, risk, reversibility, uncertainty and the architecture debt it touches. It then **proposes a route** and **waits for the owner's confirmation**, at every autonomy level, because the route sets each stage's level. The owner can skip it by saying "no triage". The entry points are the `factory-triage` skill and `/factory:start`.
- **Three tracks from a fixed table:**
  - *quick*: build → verify → review;
  - *standard*: spec → plan → build → review → finish;
  - *full*: intent → spec → plan → tasks → build → review → docs → finish.

  When two tracks fit, the heavier one wins.
- **No separate dynamic track, but every route is dynamic within rules.** A route is a list of stages from a fixed set, in a fixed order, and the track is only its starting point. Any deviation is allowed with a recorded reason, for example a spike, an architecture assessment, a migration plan or a security review. A script enforces the invariants on every route:
  - unique stages, in the fixed order;
  - at most one stage in progress;
  - nothing started after a pending stage;
  - a plan before building, except on the quick track;
  - a review after building;
  - `finish` last;
  - intent and spec always at `guided`.

  The `retro` checkup reads the recorded deviations. A recurring one is evidence for changing a track or adding one.
- **Autonomy per stage:**
  - each stage starts at the session's level;
  - intent and spec always run at `guided`;
  - on the full track, every stage runs at `guided` unless the owner raises it;
  - a higher level takes effect only through the owner's confirmation.
- **Specs per change:** a standard or full route gets `docs/changes/<date>-<name>/task.md`, and the stage documents go next to it. Living specs of the whole system (OpenSpec's model) may grow from these later. The quick track writes no files, only a one-line route in the reply.
- **Scripts, not memory (ADR 0040):**
  - `changes.js check` validates a `task.md`;
  - `changes.js status` lists unfinished changes;
  - a session-start hook reports them, so an interrupted task gets resumed instead of forgotten.
- **Re-triage:** any stage stops and proposes a new route when the task turns out bigger or riskier than classified.

## Consequences

- Every non-trivial task leaves a record of how it went through the factory, and why.
- The stages after triage don't have skills yet. Until they do, triage's route says what to do, and the owner is told when a stage has no skill. They are built one at a time (`TODO.md`).
- One more session-start hook. Its latency isn't noticeable (confirmed driver in `docs/architecture/`).

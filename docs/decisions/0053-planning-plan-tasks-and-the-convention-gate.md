# 53. Planning: plan, tasks and the convention gate

Date: 2026-09-30

## Status

Accepted. Extended by [ADR-0054](0054-build-verify-and-spike.md): the build, verify and spike stages. Extended by [ADR-0062](0062-keep-behaviour-in-migrations.md): the migration plan gets a template and a gate. Extended by [ADR-0063](0063-tests-written-apart-from-the-code.md): the task's `Tests` field.

Extends [ADR-0052](0052-intake-intent-and-spec.md).

## Context

After intake, a route plans *how* to build what the spec says. `TODO.md` had three items for this:
- **planning:** `plan.md` and a list of small tasks;
- **a convention gate:** every plan states that it follows the conventions and ADRs, or justifies each deviation;
- **a consistency check** across spec, plan and tasks, like Spec Kit's `/analyze`.

The owner asked Claude to build the remaining stages on its own, each as a pull request they review together.

## Decision

- **One skill, `factory-planning`,** for the plan, tasks and migration-plan stages. It starts from the approved spec and never changes it.
- **`plan.md`:**
  - Approach;
  - Files and data, including limits from the spec;
  - Trade-offs, always naming the simplest option;
  - Costs: a back-of-the-envelope sketch of network, disk, memory and CPU, including batching (ADR 0038);
  - **Conventions and decisions:** the convention gate, which states that the plan follows the conventions and ADRs, or lists each deviation with its reason.
- **Tasks** are `### T-<n>` blocks with Files, Covers (`AC-<n>`, or `none` with a reason), Verify (a command or concrete check), Depends on, Parallel and Status. On the standard track they're a section of `plan.md`; on the full track they're their own stage and `tasks.md`.
- **The consistency check is part of the gate** (`stage-gates.ts`):
  - every active acceptance criterion is covered by a task;
  - no task covers a criterion the spec doesn't have or has dropped;
  - dependencies only point to earlier tasks, so there are no cycles;
  - every task has its fields.

  The build stage can't be done while a task isn't.
- **Approval:** at `guided` the owner approves the plan. At `trusted` and `autonomous`, Claude approves it when it follows the conventions and nothing is left unclear, and lists its choices for the owner. Intent and spec stay the owner's (ADR 0051).
- **The migration plan** (`migration-plan.md`, when the route has one) sets out:
  - steps that can each be released on their own;
  - how old and new code coexist in between;
  - how each step is verified;
  - how to roll back. A step that can't be rolled back needs the owner's explicit approval.

## Consequences

- Every criterion is traceable to the task that builds it. The review stage can trace it further, to the test.
- A plan can't quietly drop part of the spec.
- The convention gate is checked for presence, not for truth. Whether the plan really follows the conventions is the review stage's job.

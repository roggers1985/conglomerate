# 54. Build, verify and spike

Date: 2026-09-30

## Status

Accepted. Extended by [ADR-0058](0058-project-settings.md): parallel tasks and attempts are project settings. Extended by [ADR-0055](0055-review-and-security-review.md): the review checks that the evidence holds.

Extends [ADR-0053](0053-planning-plan-tasks-and-the-convention-gate.md) and [ADR-0042](0042-checkups-in-worktrees.md) (worktrees for tasks).

## Context

After planning, a route builds its tasks. `TODO.md` had three items for this:
- **build:** a fresh subagent per task through the task agents, tests first, and "verify before claiming done";
- **worktrees:** each task in its own git worktree;
- **parallel checkups:** whether checkups may run in parallel, to be decided together with the worktrees.

The consistency check reached from criteria to tasks (ADR 0053), but not yet to tests.

## Decision

- **One skill, `factory-build`,** for the build, verify and spike stages. It coordinates from the main session; subagents do the building.
- **Branches:**
  - all of a change's work happens on `change/<name>`. Triage creates it for a standard or full route, and the build creates it on the quick track;
  - each task gets its own worktree and a branch `change/<name>--T-<n>`, created from the change's branch, because a worktree starts from the remote's default branch (ADR 0042);
  - the coordinator merges the task in, runs the checks, and removes the worktree and branches.
- **Each task:**
  - is built by the task agent that fits it (`code-small`, `code` or `code-complex`, through model routing);
  - is test-first, with each criterion named in its test's name (`it("AC-1: …")`);
  - stays within the task's files;
  - is verified by the task's own Verify command plus the project's fast checks (type check, lint, nearby tests), reported as commands and results, never "it works". The coordinator runs the full suite after each merge, so a large application doesn't run it once per task.
- **Retries:** at most 3 attempts per task (the autonomy limits, ADR 0044). Then it escalates once to a stronger model (ADR 0021), and after that stops and reports.
- **Parallel:**
  - tasks marked `Parallel: yes`, whose dependencies are done, may run at the same time, at most 3 at once. They are merged one at a time, and the parallel run stops on a merge conflict;
  - **checkups stay one at a time.** They're recurring and cheap to wait for, while parallel runs would multiply cost and conflict over the same files.
- **Verify before claiming done:** the build ends with `verification.md` (on the quick track, which has no change folder, the same content goes in the reply and the pull request). It lists the checks that ran, and gives evidence for every active acceptance criterion (the test that names it, or a concrete check). The gate refuses a done build while a task isn't done or a criterion lacks evidence, and reports evidence for a criterion the spec doesn't have or has dropped. That takes the consistency check from criteria through tasks to tests.
- **A spike** answers a question on a throwaway branch that is never merged. It records `spike.md`: the question, the findings and a recommendation.

## Consequences

- Every change arrives at review with its evidence per criterion.
- Building is more expensive than doing everything in one session (a subagent per task), but each task starts with a clean context, and a failed task can't tangle the others.
- The gate checks that evidence is *named*, not that the named test exists and passes. The review stage checks that, and a later script could too (`TODO.md`).

# 63. Tests written apart from the code

Date: 2026-10-10

## Status

Accepted

Amends [ADR-0054](0054-build-verify-and-spike.md): a task with testable behaviour is built by a test agent and a code agent, with an arbiter for a disputed test. Amends [ADR-0055](0055-review-and-security-review.md): the review breaks the code to see each criterion's test fail. Extends the task format of [ADR-0053](0053-planning-plan-tasks-and-the-convention-gate.md) with a `Tests` field. Leaves [ADR-0016](0016-documentation-with-tested-examples.md) unchanged: the rule on comments doesn't apply to the documentation of a declaration. Follows [ADR-0015](0015-task-agents-and-model-overrides.md): the new roles use the existing task agents.

## Context

Until now, one subagent per task wrote both the tests and the code, test-first (ADR 0054). Test-first in one context still lets the tests repeat the code's reading of the spec. When the agent misreads a criterion, the test and the code agree with each other and both are wrong. The review only saw this afterwards, and it checked that a named test exists and passes (ADR 0055), not that it can fail.

The owner asked for three things in the keep-behaviour-in-migrations change (2026-10-10):

- a test is written by an agent that never sees the implementation;
- tests read as a specification, so the intent of the code is clear from them;
- the review proves that a test can fail, and the production code says why, not what.

Before this decision:

- one agent per task wrote the tests and the code;
- `code-testing` said what to test and how, but not how a test should read;
- the review checked that a test passes, never that it fails when the behaviour breaks;
- the conventions said little about comments in production code.

## Decision

**On the standard and full tracks, a task with testable behaviour is built by two agents in turn.** This changes the build's task flow of ADR 0054 (`factory-build`, "Each task"):

1. **The test agent** writes the tests. It reads `spec.md`, its task and the conventions, and nothing of the implementation: not `plan.md`, not the code. It may read the signature and doc comment of an existing export it tests, never its body. For a migration it also gets the migration plan's Behaviour test section (ADR 0062). It commits the tests failing, on its own branch `change/<name>--T-<n>--tests`.
2. **The coordinator checks the red run.** The tests must fail because the behaviour is missing: an assertion, or an import of an export the task adds. A broken test is a failed attempt. A test that already passes is either vacuous, which is a failed attempt, or shows that the behaviour exists, which goes back to the owner. `verification.md` records the run under Checks.
3. **The code agent** makes the tests pass, on `change/<name>--T-<n>`, created from the test agent's branch. It never edits the tests. Before the merge, the coordinator checks that the test files are identical on both branches. A difference fails the code agent's attempt.
4. **The merge** takes the test commits followed by the code commits, so the history shows that the tests came first.

Two agents, so the code can't shape the tests and one reading of the spec doesn't end up in both.

**A disputed test goes to an arbiter, once per task.** When the code agent finds that a test is wrong, it stops without editing it and explains why. A fresh review agent, the *arbiter*, gets the spec, the test, the failing output and the code agent's reason, but not the code: a judge who reads the code tends to accept its reading of the spec. It rules one of three ways:

| Ruling | What follows |
|---|---|
| The code is wrong | The code agent carries on. |
| The test is wrong | The test agent corrects the test on its branch, and the code agent merges it and carries on. |
| The spec is unclear | The task stops and goes to the owner. An amended spec is approved through intake, and the tests follow it. |

A second dispute in the same task goes to the owner, at every autonomy level, so a dispute can't loop. `verification.md` records each ruling under `## Rulings`.

**The limits count per role.** The test agent has `attemptsPerTask` attempts to write tests that fail for the right reason, and the code agent as many to make them pass (ADR 0058). A code agent that stops to dispute a test hasn't failed an attempt. Each role escalates once to a stronger model when its last attempt fails (ADR 0021). Within a task the agents run one after another, so `parallelTasks` still counts tasks.

**The roles use the existing task agents.** The test agent is `factory:tasks:code`, or `code-complex` when the code agent is; never `code-small`, because writing tests from a spec involves the conventions. The arbiter is `factory:tasks:review`, because judging a test against a spec is review work. There are no new agent types, and `models.json` doesn't change.

**Four cases keep one agent, or none for the tests:**

- **The quick track.** One agent writes the tests and the code, test-first, as before. The review makes up for the missing second agent: it checks that the tests follow the spec's words, not the code's structure, and it runs the mutation check.
- **A task with no testable behaviour,** such as a rename or a text change. Its `Tests` field says `none: <why>`, and it skips the test agent.
- **A migration's first task** is a test agent's task with no code agent. It writes the behaviour test and sees it *pass* on the old code: the one case where the tests aren't red (ADR 0062).
- **A later migration task** that changes the code under test without an intended difference has `Tests: the behaviour test of T-1`: it skips the test agent, and the behaviour test's files must stay unchanged in the merge diff.

**Each task says what its test agent tests,** in a new field `Tests` in the task format of ADR 0053. Every task on the standard and full tracks has one; it is optional only in that the gate doesn't check it, because older task lists lack it, and the coordinator adds a missing line before dispatching the test agent. It names the interface, such as a function, a command or an endpoint, never internals; or it says `none: <why>`. The test agent doesn't read the plan, so the task has to name the interface. When the route has a migration plan, T-1 writes the behaviour test, and every task that changes the code under test depends on it (`factory-planning`).

**Tests read as a specification,** at every level (`code-testing`, "Tests that read as a specification"):

- the name states the behaviour in domain words, with the criterion's id first where it proves one (`it("AC-1: downloads the jobs as CSV")`, ADR 0054);
- one behaviour per test;
- arrange, act and assert are visible;
- a failure says which behaviour broke, through the name, and an assertion message where the value alone doesn't explain it;
- in an end-to-end test, one flow is one behaviour, and its steps may alternate act and assert.

**The review breaks the code on purpose to see each criterion's test fail.** This is the *mutation check*, added to what the review checks in ADR 0055 (`factory-review`, "The mutation check"). For each criterion whose evidence is a test, the reviewer:

1. makes the smallest change in the production code that breaks what the criterion states, such as inverting a condition, removing a guard, moving a limit by one or skipping an error path;
2. runs the criterion's test and sees it fail;
3. restores the code before the next break.

Every error path and limit of the criterion gets its own break. A criterion that only changes skill or document text may be skipped, with the reason recorded. The reviewer works in its own worktree, which is thrown away after the review: it commits nothing and leaves the worktree clean. `review.md` records each break in a `## Mutation checks` table. A test that stays green is a finding: **high** when the break hits what the criterion states, **medium** when it hits an edge case or limit around it. The test agent fixes it by strengthening the test.

**Comments say why, never what** (`code-readability`, "Comments", and `code-documentation`). A *comment* here is everything in production code beyond the documentation of a declaration: a note in a function body, or on internal code. It appears only where the why isn't obvious, and gives one of three kinds of why: a constraint, an ADR, or a rejected alternative. It never repeats what the code does; a better name does that. A short `/** */` summary of what a declaration is or returns is documentation, not such a comment, on an internal declaration as much as on an export (the owner's decision in review round 2), so ADR 0016 is unchanged. The why of a declaration goes in its `@remarks`. `core.md`'s sentence on internal code says the same.

## Consequences

- A test can no longer just repeat the code's reading of the spec: it was written before the code, by an agent that didn't see it. A misread criterion now shows up as a dispute or a failing test, not as code and test that agree.
- **A task with testable behaviour costs about 40 to 60% more.** A task agent run takes roughly 50,000 to 150,000 tokens, and the test agent adds roughly 30,000 to 80,000. Text-only tasks cost the same, because they skip the test agent. An arbitration adds roughly 20,000 to 40,000 tokens on Opus, at most once per task.
- **The mutation check adds about 4,000 tokens per break** to the review. A change with 10 criteria and two breaks each adds about 80,000 tokens.
- **A task has two worktrees at once** while it's built. With 3 parallel tasks that is up to 6, about 600 MB of installed dependencies in this repository, freed after each merge.
- **The subagent limit at `autonomous` is reached sooner.** A task with tests uses two or three subagents instead of one, so a change reaches `subagentsPerChange` (10 by default, ADR 0058) after about four such tasks. The default and the rule stay as they are, by the owner's decision. `TODO.md` holds an item to revisit the default after the first change built at `autonomous`.
- **The quick track keeps one agent** for the tests and the code. The review's check of the tests and the mutation check make up for it.
- Nothing checks the new records by script. The gates ignore `## Rulings`, `## Mutation checks` and the `Tests` field, and the review checks them. The `TODO.md` item on a script for the evidence in `verification.md` also covers the mutation checks, and that the code agent left the test files alone.
- The mutation check is manual and targeted. Mutation-testing tooling isn't part of this decision.

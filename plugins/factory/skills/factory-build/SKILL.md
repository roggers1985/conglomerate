---
name: factory-build
description: The factory's build, verify and spike stages. Builds a change task by task, with a test agent that writes the tests from the spec and commits them failing, a different code agent that makes them pass, and an arbiter that rules on a disputed test, each in a fresh subagent and its own git worktree, then verifies the whole change and records evidence for every acceptance criterion in verification.md. A spike answers a question with throwaway code and records its findings. Use when a route's build, verify or spike stage starts, or to resume a build.
metadata:
  task: code
---

# Build

The build turns the task list (`tasks.md`, or the Tasks section of `plan.md`) into working, tested code on the change's branch, `change/<name>` (ADR 0054). You coordinate; subagents build. Don't build tasks yourself in the main session.

## Before the first task

- Work on the change's branch: `git switch change/<name>`. On the quick track, create it first from the default branch (`git switch -c change/<YYYY-MM-DD>-<short-name>`).
- Set the build stage to `in-progress` in `task.md`, and commit.
- On the standard and full tracks, you create `verification.md` next to `task.md` at the first run the build records (a red run, or a migration's run on the old code), with the `## Checks` section of the template under "The verify stage". Add each later run to it as the build goes, and commit it with the task's status.

**When the route has a migration plan,** the first task's test agent writes the behaviour test the plan names and runs it on the old code, before any task changes the code under test (`code-testing`, "Migrations that keep behaviour"). A test that never passed on the old code proves nothing. In place, the test is committed before the swap. `verification.md` records that run under Checks: the command, the commit it ran on, and the result.

- **When the plan names a data check** instead of a test (a schema or data migration), the check runs before and after each step, and `verification.md` records both results.
- **On the quick track** there is no migration plan and no `verification.md`. The build still writes the behaviour test first and runs it on the old code. Record that run (the command, the commit and the result) in your reply and in the pull request's description, with the evidence. The review checks it there.

## Each task

A task is built by two agents in turn. A **test agent** writes its tests from the spec and commits them failing. A different **code agent** then makes them pass, without touching the tests. Two agents, so the code can't shape the tests and one reading of the spec doesn't end up in both. The exceptions are under "Special cases" below.

1. **Pick the next task:** the first `pending` one whose dependencies are all `done`. Set it to `in-progress` in the task list.
2. **Choose its agents** by what the task needs (model routing, `models.json`):
   - **the code agent:**
     - `factory:tasks:code-small` only for an edit that touches no convention (a rename, formatting, a typo). Anything that involves a convention (fail fast, the exported surface, bounds, error handling) goes to `code` at least: a small model gets the mechanics right and the convention wrong (a silent fallback, an export only for a test);
     - `factory:tasks:code` for ordinary work;
     - `factory:tasks:code-complex` for concurrency, security-sensitive code or a hard bug;
   - **the test agent:** `factory:tasks:code`, or `code-complex` when the code agent is. Never `code-small`: writing tests from a spec involves the conventions.
3. **Dispatch the test agent in its own worktree** (Agent tool, `isolation: "worktree"`, ADR 0042). Its only source for the interface it tests is the task's `Tests` line, so check that the task has one first. When it lacks one (an older task list), add it to the task from the plan, and commit. Tell the test agent:
   - to create its branch from the change's branch, not from what the worktree started on: `git switch -c change/<name>--T-<n>--tests change/<name>`;
   - to read `CLAUDE.md`, the change's `spec.md` and its task (with its `Tests` field, which names the interface to test) from disk, and the conventions. Nothing else: not `plan.md`, not the implementation. For a migration, also the migration plan's Behaviour test section. It may read the signature and doc comment of an existing export it tests, never its body;
   - to write the tests for the criteria the task covers, naming each criterion in the test's name (e.g. `it("AC-1: downloads the jobs as CSV")`), run them, and commit them failing, with any fixture or helper they read;
   - to install dependencies from the lockfile, and that in a worktree Claude Code blocks heredocs and chained shell commands: edit files with the Edit and Write tools, and run one command at a time.
4. **Check the red run** on the test branch. The tests must fail because the behaviour is missing: an assertion, or an import of an export the task adds.
   - A broken test (a syntax error, a wrong path to an existing module) is a failed attempt.
   - A test that already passes is either vacuous, which is a failed attempt, or shows the behaviour exists, which goes back to the owner.
   - Record the run under Checks in `verification.md`: the task, the commit and how many tests failed.
5. **Dispatch the code agent in a second worktree.** Tell it:
   - to create its branch from the test agent's branch: `git switch -c change/<name>--T-<n> change/<name>--T-<n>--tests`;
   - to read `CLAUDE.md`, the change's `spec.md`, `plan.md` and its task from disk, and to install dependencies from the lockfile;
   - to make the tests pass, and **never to edit them**. The fixtures and helpers the tests read are part of the tests. When it finds a test wrong, it stops without editing it, and replies with the test, the failing output and its reason (see "When the code agent disputes a test");
   - to follow the conventions, and to stay inside the task's files. Anything else it notices goes in its reply, not in the code;
   - to run the task's **Verify** command and the project's **fast checks** (type check, lint, and the tests near the change), and to commit only when they pass. The full suite runs after the merge (step 6), so it doesn't run once per task;
   - **verify before claiming done:** reply with the commands it ran and their results, not with "it works";
   - **not to regenerate generated files** (the project's generate command): you do that after the merge, so task branches don't conflict on them;
   - that in a worktree Claude Code blocks heredocs and chained shell commands: edit files with the Edit and Write tools, and run one command at a time.
6. **Take the result in:**
   - check that the code agent left the tests alone, fixtures and helpers included. A difference fails the code agent's attempt:
     - the test agent's files are the ones `git diff --name-only change/<name>...change/<name>--T-<n>--tests` lists (three dots: the diff from where the task branched, so files that other tasks merged since don't count), and `git diff change/<name>--T-<n>--tests change/<name>--T-<n> -- <those files>` must be empty;
     - the code agent's files are the ones `git diff --name-only change/<name>--T-<n>--tests change/<name>--T-<n>` lists, and none of them may be a test, a fixture or a test helper;
   - merge `change/<name>--T-<n>` into `change/<name>`. It holds the test commits followed by the code commits, so the history shows the tests came first;
   - regenerate the project's generated files there (its own generate command, e.g. `bun run generate`), and commit what changed;
   - run the project's **full** check suite there. When it fails, the task isn't done: give it back to a code agent with the failure;
   - remove both worktrees and both task branches (`git worktree remove`, `git branch -d`);
   - set the task to `done` in the task list, and commit.
   - **When a subagent is interrupted** (a usage limit, an error), resume that same agent with `SendMessage`: it keeps its context and its uncommitted work. Don't start a new one. To inspect its worktree, use `git -C <worktree> …`; never `cd` into it, which moves your session into the worktree.
7. **When it fails:** attempts count per role. The test agent has at most `attemptsPerTask` attempts to write tests that fail for the right reason, and the code agent as many to make them pass (the "Factory settings" section of the session context; 3 by default, ADR 0058). A code agent that stops to dispute a test hasn't failed an attempt. When a role's last attempt fails, that role tries once with a stronger task agent (`code-complex`, then `model: "fable"`, ADR 0021). If that fails too, stop and report to the owner what was tried.

**When the code agent disputes a test,** dispatch an **arbiter**: a fresh `factory:tasks:review` agent in its own worktree. Give it the spec, the test, the failing output and the code agent's reason, and not the code: a judge who reads the code tends to accept its reading of the spec. It rules one of three ways:
- *the code is wrong:* resume the code agent with `SendMessage`, and it carries on;
- *the test is wrong:* resume the test agent, which corrects the test and commits it on its branch. The code agent merges that branch into its own and carries on;
- *the spec is unclear:* the task stops and goes to the owner. An amended spec is approved through `factory-intake`, and the tests follow it.

There is at most one arbitration per task. A second dispute goes to the owner, at every autonomy level. Record each ruling under `## Rulings` in `verification.md`.

**Special cases:**
- **On the quick track** one agent writes the tests and the code. The review checks the tests. Dispatch it in its own worktree, and tell it:
  - to create its branch from the change's branch: `git switch -c change/<name>--T-<n> change/<name>`;
  - to read `CLAUDE.md` and the conventions, and the task and its criteria as you give them (the quick track has no change folder);
  - to write the tests first, naming each criterion in the test's name as in step 3, to run them and see them fail, and only then to make them pass;
  - for a migration, to write the behaviour test first instead, run it on the old code and see it *pass*, and commit it before changing the code under test. Only then does it make the change. Its reply names that run: the command, the commit and the result (see "Before the first task");
  - the rest of step 5: follow the conventions and stay inside the task's files, run the **Verify** command and the fast checks before committing, reply with the commands and their results, don't regenerate, and the worktree rules.

  Step 6 then merges its branch, without the check on the test files.
- **A task whose `Tests` field says `none: <why>`** (a rename, text) has no tests to write. It skips the test agent and its red run. One agent builds it with the code agent's prompt of step 5, on a branch from `change/<name>`, with one difference: it may change tests only mechanically (a rename, a moved path), never their cases or expectations. Step 6 merges its branch without the check on the test files, since there is no `--tests` branch.
- **A migration's first task** (T-1) is a test agent's task with no code agent. The test agent writes the behaviour test and sees it *pass* on the old code: the one case where its tests aren't red. Step 6 merges its test branch, `change/<name>--T-1--tests`.
- **A migration task whose `Tests` field says `the behaviour test of T-1`** changes the code under test without an intended difference. The behaviour test already passes on the old code, so there is nothing new to write: it skips the test agent and its red run. Its code agent branches from `change/<name>` (`git switch -c change/<name>--T-<n> change/<name>`) and makes the new code pass the behaviour test. It adds no tests, fixtures or helpers. In step 6:
  - `git diff change/<name>...change/<name>--T-<n> -- <the behaviour test's files>` must be empty: the files the migration plan's Behaviour test section names, recorded outputs included;
  - none of the files `git diff --name-only change/<name>...change/<name>--T-<n>` lists may be a test, a fixture or a test helper, as for any code agent.
- **A migration task that changes the behaviour test** gets a test agent as usual: adding the new version to a side-by-side suite, or, at the swap, changing the assertions for the spec's intended differences. Its test agent stays within "What 'unchanged' means" in `code-testing`.

**Parallel tasks:**
- tasks marked `Parallel: yes`, whose dependencies are done, may run at the same time, **at most `parallelTasks` at once** (3 by default). It counts tasks: within a task the agents run one after another;
- merge their branches one at a time, running the checks after each;
- if a merge conflicts, stop the parallel run, and finish the conflicting task on its own.

## The verify stage, and the end of the build

After the last task, verify the whole change on `change/<name>`:

1. Run every check command of the project. Where the change has a user-facing part, also run the app and try the flows the spec describes (the `run` skill).
2. Complete `verification.md` next to `task.md`, which the build started at its first recorded run (or write it now, when no run was recorded):

```markdown
# Verification: <title>

## Checks

- T-1 red run: `bun test src/export/csv.test.ts` on `3f9c2a1`: 2 tests failed, on the missing `exportCsv`
- `bun run check`: passed (312 tests)
- Ran the app and exported 3 jobs. The CSV opened in a spreadsheet, with the right columns.

## Evidence

- AC-1: `src/export/csv.test.ts` › "AC-1: downloads the jobs as CSV"
- AC-2: `src/export/button.test.tsx` › "AC-2: disables the button while exporting"

## Rulings

None.
```

A ruling names the task, the disputed test, the ruling and its reason, e.g. `- T-2, "AC-2: disables the button while exporting": the test is wrong; the spec disables it only after the click`. Write "None." when no task needed one.

Every active criterion of the spec needs evidence: the test that names it, or the concrete check that shows it. A criterion without evidence means the build isn't done: add the missing test as a new task.

**On the quick track** there is no change folder, so there's no `verification.md`: put the same two parts, the checks that ran and the evidence, in your reply to the owner and in the pull request's description.

3. On the standard and full tracks, set the build (and verify) stage to `done`, and run `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check docs/changes/<name>/task.md`. It refuses a done build while a task isn't done or `verification.md` lacks evidence for a criterion. Fix what it reports, then commit.

## The spike stage

A spike answers a question the plan can't answer yet, such as "can the database stream 100,000 rows?". It runs before the plan:

- Build the smallest thing that answers the question, on a throwaway branch (`change/<name>--spike`). Its code is never merged: delete the branch afterwards.
- Write `spike.md` with `## Question`, `## Findings` (what was tried and measured) and `## Recommendation` (what the plan should do). The gate checks that all three are there.

## Throughout

- Keep `task.md` and the task list current, so an interrupted build resumes at the right task.
- A decision the plan didn't foresee gets an ADR: accepted when the owner decided it, or *Proposed* at `autonomous` (ADR 0044).
- When the build shows the change is bigger or riskier than planned, stop and re-triage (see `factory-triage`).

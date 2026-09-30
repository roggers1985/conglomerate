---
name: factory-build
description: The factory's build, verify and spike stages. Builds a change task by task, each in a fresh subagent and its own git worktree, test-first, then verifies the whole change and records evidence for every acceptance criterion in verification.md. A spike answers a question with throwaway code and records its findings. Use when a route's build, verify or spike stage starts, or to resume a build.
metadata:
  task: code
---

# Build

The build turns the task list (`tasks.md`, or the Tasks section of `plan.md`) into working, tested code on the change's branch, `change/<name>` (ADR 0054). You coordinate; subagents build. Don't build tasks yourself in the main session.

## Before the first task

- Work on the change's branch: `git switch change/<name>`. On the quick track, create it first from the default branch (`git switch -c change/<YYYY-MM-DD>-<short-name>`).
- Set the build stage to `in-progress` in `task.md`, and commit.

## Each task

1. **Pick the next task:** the first `pending` one whose dependencies are all `done`. Set it to `in-progress` in the task list.
2. **Choose its task agent** by what the task needs (model routing, `models.json`):
   - `factory:tasks:code-small` for a mechanical edit;
   - `factory:tasks:code` for ordinary work;
   - `factory:tasks:code-complex` for concurrency, security-sensitive code or a hard bug.
3. **Dispatch it in its own worktree** (Agent tool, `isolation: "worktree"`, ADR 0042). Tell the subagent:
   - to create its branch from the change's branch, not from what the worktree started on: `git switch -c change/<name>--T-<n> change/<name>`;
   - to read `CLAUDE.md`, the change's `spec.md`, `plan.md` and its task from disk, and to install dependencies from the lockfile;
   - **test-first:** write the test for the criteria the task covers, naming each criterion in the test's name (e.g. `it("AC-1: downloads the jobs as CSV")`), see it fail, then make it pass;
   - to follow the conventions, and to stay inside the task's files. Anything else it notices goes in its reply, not in the code;
   - to run the task's **Verify** command and the project's check commands, and to commit only when all pass;
   - **verify before claiming done:** reply with the commands it ran and their results, not with "it works".
4. **Take the result in:**
   - merge the task's branch into `change/<name>`;
   - run the project's checks there;
   - remove the worktree and both of its branches (`git worktree remove`, `git branch -d`);
   - set the task to `done` in the task list, and commit.
5. **When it fails:** give the same task at most 3 attempts (the autonomy limits, ADR 0044). If the third fails, try once with a stronger task agent (`code-complex`, then `model: "fable"`, ADR 0021). If that fails too, stop and report to the owner what was tried.

**Parallel tasks:**
- tasks marked `Parallel: yes`, whose dependencies are done, may run at the same time, **at most 3 at once**;
- merge their branches one at a time, running the checks after each;
- if a merge conflicts, stop the parallel run, and finish the conflicting task on its own.

## The verify stage, and the end of the build

After the last task, verify the whole change on `change/<name>`:

1. Run every check command of the project. Where the change has a user-facing part, also run the app and try the flows the spec describes (the `run` skill).
2. Write `verification.md` next to `task.md`:

```markdown
# Verification: <title>

## Checks

- `bun run check`: passed (312 tests)
- Ran the app and exported 3 jobs: the CSV opened in a spreadsheet with the right columns.

## Evidence

- AC-1: `src/export/csv.test.ts` › "AC-1: downloads the jobs as CSV"
- AC-2: `src/export/button.test.tsx` › "AC-2: disables the button while exporting"
```

Every active criterion of the spec needs evidence: the test that names it, or the concrete check that shows it. A criterion without evidence means the build isn't done: add the missing test as a new task.

3. Set the build (and verify) stage to `done`, and run `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check docs/changes/<name>/task.md`. It refuses a done build while a task isn't done or `verification.md` lacks evidence for a criterion. Fix what it reports, then commit.

## The spike stage

A spike answers a question the plan can't answer yet, such as "can the database stream 100,000 rows?". It runs before the plan:

- Build the smallest thing that answers the question, on a throwaway branch (`change/<name>--spike`). Its code is never merged: delete the branch afterwards.
- Write `spike.md` with `## Question`, `## Findings` (what was tried and measured) and `## Recommendation` (what the plan should do). The gate checks that all three are there.

## Throughout

- Keep `task.md` and the task list current, so an interrupted build resumes at the right task.
- A decision the plan didn't foresee gets an ADR: accepted when the owner decided it, or *Proposed* at `autonomous` (ADR 0044).
- When the build shows the change is bigger or riskier than planned, stop and re-triage (see `factory-triage`).

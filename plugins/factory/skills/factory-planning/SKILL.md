---
name: factory-planning
description: The factory's planning stages. Turns an approved spec into plan.md (approach, files and data, trade-offs, a back-of-the-envelope cost sketch, and the convention gate) and a task list of small tasks that each name their files, the acceptance criteria they cover and how to verify them. Also writes the migration plan when the route has one. Use when a route's plan, tasks or migration-plan stage starts, or when the owner asks to plan or re-plan a change.
metadata:
  task: planning
---

# Planning

Planning decides **how** to build what the spec says, in the change's folder (`docs/changes/<name>/`). It starts from the approved `spec.md` (and `intent.md`), and never changes them: a plan that needs a different spec goes back to the owner (ADR 0053).

## The plan stage: `plan.md`

```markdown
# Plan: <title>

## Approach

The design in a few paragraphs. Open with the idea in a sentence or two. Then say which parts change, how data
flows, and why this way. Name the units it touches (`docs/architecture/`).

## Files and data

The files to add or change. Also any change to a schema, an API or the configuration, with its limits from the
spec's Limits section.

## Trade-offs

The options you considered, and why you chose this one. Always name the simplest option, even if you don't choose
it.

## Costs

A rough estimate of the network, disk, memory and CPU the change uses. For example: "10,000 jobs × ~1 KB = 10 MB per
export. It's streamed, so memory stays flat." Say where batching applies. Write "negligible" only where it truly is
(ADR 0038).

## Conventions and decisions

The convention gate: does the plan follow the conventions and ADRs? Write "Follows the conventions and ADRs", or list
each deviation with its reason. Name the ADRs that apply, and every new decision this plan makes. Each new decision
gets its own ADR, written during the build.
```

On the **standard** track, the task list goes into the plan as a `## Tasks` section. On the **full** track, it gets its own stage and file.

## The tasks stage: `tasks.md`

Small tasks, each a few minutes of work for one agent, in the order they're built:

```markdown
# Tasks: <title>

### T-1: Parse the export request and check its limits

- Files: `src/export/request.ts`, `src/export/request.test.ts`
- Covers: AC-1, AC-4
- Tests: `parseExportRequest` in `src/export/request.ts`
- Verify: `bun test src/export/request.test.ts`
- Depends on: none
- Parallel: no
- Status: pending

### T-2: Stream jobs as CSV

- Files: `src/export/csv.ts`, `src/export/csv.test.ts`
- Covers: AC-1, AC-2
- Tests: the endpoint `GET /jobs/export.csv`
- Verify: `bun test src/export/csv.test.ts`
- Depends on: T-1
- Parallel: no
- Status: pending
```

- **Covers** names the spec's criteria (`AC-<n>`). A task that covers none (setup, a refactor it needs) writes `none` with the reason.
- **Every active criterion is covered by at least one task.** No task covers a criterion the spec doesn't have or has dropped.
- **Depends on** only names earlier tasks. **Parallel: yes** marks a task that can be built at the same time as the others marked so, because it touches different files and depends on nothing unfinished.
- **Tests** says what the task's test agent tests: the interface, such as a function, a command or an endpoint, never internals. The test agent reads neither the plan nor the code, so this line is its only source for the interface. Every task on the standard and full tracks has one. It is optional only in that the gate doesn't check it, because older task lists lack it. A task with no testable behaviour, such as a rename or a text change, writes `none: <why>`, and skips the test agent.
- **Verify** is a command or a concrete check, never "it works".
- Tests are part of each task: the test agent writes them from the spec and the task, and the code agent makes them pass (`factory-build`, `code-testing`).
- **When the route has a migration plan,** T-1 writes the behaviour test the migration plan names and runs it on the old code. Every task that changes the code under test depends on T-1, so none of them starts before that run. A task that changes the code under test without an intended difference writes `Tests: the behaviour test of T-1`: it has no new test to write, so it skips the test agent. A task that adds the new version to a side-by-side suite, or asserts an intended difference, names its tests as usual (`factory-build`, "Special cases").

## The migration-plan stage

When the route has one, write `migration-plan.md` before the plan. It covers two kinds of migration:
- **code that moves to another solution without changing its behaviour** (a library swap, a framework upgrade, a rewrite, a part replaced step by step). Its behaviour test follows `code-testing`, "Migrations that keep behaviour";
- **schema and data changes**, without losing anything, following `code-sql`.

```markdown
# Migration plan: <title>

## Steps

The steps in order, each safe to release on its own. For each: what changes, and what the system looks like after
it.

## Old and new

How the old and new code coexist during the migration. For example: both behind the same interface, with a flag
that chooses. Or: nothing runs side by side, the old code is replaced in place in one step.

## Behaviour test

The test that shows the behaviour stayed the same. It passes on the old code first, then on the new code
unchanged. Name:

- the interface it tests: a public function, an endpoint or a command, never internals;
- its form: side by side (one suite runs against both versions), or in place (committed before the swap);
- every file the test consists of, recorded outputs included, so the review can diff them all;
- where the recorded outputs come from when the old code can't run in a test (a golden master);
- the level the test runs at when the test framework itself is migrated: one that doesn't depend on the framework, such as an end-to-end test or running the command.

For a schema or data migration without such code, say how the data is checked instead. For example: row counts and
checksums before and after. Never leave this section empty.

## Verification

How to verify each step: the command or check, and what result shows the step worked.

## Rollback

How to roll back each step. Where a step can't be rolled back, say why. The owner approves each such step
explicitly.
```

## The gate

1. Set the stage to `in-progress` in `task.md` when you start it.
2. Write the document. Mark anything the owner must decide as `[NEEDS CLARIFICATION: …]`, with your recommendation.
3. At `guided`, wait for the owner's approval of the plan. At `trusted` and `autonomous`, approve it yourself when it follows the conventions and nothing needs clarification, and list your choices for the owner (their alternatives and why).
4. Set the stage to `done`, and run `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check docs/changes/<name>/task.md`. It refuses a done stage when:
   - a section is missing or empty;
   - a `[NEEDS CLARIFICATION]` is still open;
   - a task lacks its files, criteria, verification or status;
   - a task depends on a later one;
   - a criterion is left uncovered, or a task covers one the spec doesn't have;
   - a done migration plan misses one of its five sections, or has one empty.
5. Fix what it reports, then commit.

When planning shows the change is bigger or riskier than triage thought, stop and re-triage (see `factory-triage`).

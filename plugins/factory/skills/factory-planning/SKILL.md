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

Whether the plan follows the conventions and ADRs: write "Follows the conventions and ADRs", or list each deviation
with its reason. Name the ADRs that apply. A new decision this plan makes gets its own ADR, written during the build.
```

On the **standard** track, the task list goes into the plan as a `## Tasks` section. On the **full** track, it gets its own stage and file.

## The tasks stage: `tasks.md`

Small tasks, each a few minutes of work for one agent, in the order they're built:

```markdown
# Tasks: <title>

### T-1: Parse the export request and check its limits

- Files: `src/export/request.ts`, `src/export/request.test.ts`
- Covers: AC-1, AC-4
- Verify: `bun test src/export/request.test.ts`
- Depends on: none
- Parallel: no
- Status: pending

### T-2: Stream jobs as CSV

- Files: `src/export/csv.ts`, `src/export/csv.test.ts`
- Covers: AC-1, AC-2
- Verify: `bun test src/export/csv.test.ts`
- Depends on: T-1
- Parallel: no
- Status: pending
```

- **Covers** names the spec's criteria (`AC-<n>`). A task that covers none (setup, a refactor it needs) writes `none` with the reason.
- **Every active criterion is covered by at least one task.** No task covers a criterion the spec doesn't have or has dropped.
- **Depends on** only names earlier tasks. **Parallel: yes** marks a task that can be built at the same time as the others marked so, because it touches different files and depends on nothing unfinished.
- **Verify** is a command or a concrete check, never "it works".
- Tests are part of each task: the task that adds behaviour adds its test (test-first, `code-testing`).

## The migration-plan stage

When the route has one, write `migration-plan.md` before the plan. It says how data or schemas change without losing anything, following `code-sql`:
- the steps, each safe to release on its own;
- how old and new code coexist during the migration;
- how to verify each step;
- how to roll back, or why a step can't be rolled back (the owner approves those explicitly).

## The gate

1. Set the stage to `in-progress` in `task.md` when you start it.
2. Write the document. Mark anything the owner must decide as `[NEEDS CLARIFICATION: …]`, with your recommendation.
3. At `guided`, wait for the owner's approval of the plan. At `trusted` and `autonomous`, approve it yourself when it follows the conventions and nothing needs clarification, and list your choices for the owner (their alternatives and why).
4. Set the stage to `done`, and run `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check docs/changes/<name>/task.md`. It refuses a done stage when:
   - a section is missing or empty;
   - a `[NEEDS CLARIFICATION]` is still open;
   - a task lacks its files, criteria, verification or status;
   - a task depends on a later one;
   - a criterion is left uncovered, or a task covers one the spec doesn't have.
5. Fix what it reports, then commit.

When planning shows the change is bigger or riskier than triage thought, stop and re-triage (see `factory-triage`).

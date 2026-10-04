# Plan: Keep behaviour the same during a migration

## Approach

The convention comes first, then the stages that enforce it, then the record.

1. **The convention.** `code-testing` gets a section on behaviour tests for migrations, and `core.md` one line that points to it.
2. **The script check.** The migration plan gets a gate, like the spike's: `migrationPlanProblems` in `stage-gates.ts` checks the five sections. The route check runs it when the migration-plan stage is done.
3. **The stages.** Each skill that a migration passes through gets its part:
   - triage adds the migration-plan stage for code migrations that keep behaviour;
   - planning gets the migration plan's template;
   - build makes the behaviour test the first task, run on the old code;
   - review checks that the test passed on the old code and stayed unchanged.

   The template test also runs the new template through its gate.
4. **The record:** an ADR and two glossary entries.

All of it lives in unit `factory`, with no new dependencies.

## Files and data

| File | What changes |
|---|---|
| `plugins/factory/skills/code-testing/SKILL.md` | A section on behaviour tests for migrations. |
| `plugins/factory/conventions/core.md` | One line under Tests. |
| `plugins/factory/scripts/stage-gates.ts` and its test | `MIGRATION_PLAN_SECTIONS` and `migrationPlanProblems`. |
| `plugins/factory/scripts/changes.ts` and its test | Reads `migration-plan.md` and runs its gate when the stage is done. `dist/changes.js` is regenerated. |
| `plugins/factory/skills/factory-triage/SKILL.md` | The migration-plan deviation also covers code migrations. |
| `plugins/factory/skills/factory-planning/SKILL.md` | The migration plan's template and its gate. |
| `plugins/factory/skills/factory-build/SKILL.md` | The behaviour test as the first task, run on the old code. |
| `plugins/factory/skills/factory-review/SKILL.md` | The review's migration check. |
| `scripts/skill-templates.test.ts` | Also runs the migration plan's template through its gate. |
| `docs/decisions/0062-keep-behaviour-in-migrations.md` | New. |
| `GLOSSARY.md`, `TODO.md` | Two entries; the gate limitation for criteria with a sub-list. |

No data or schema changes. `migration-plan.md` is read like the other change documents: at most 1 MiB, and never through a symbolic link (ADR 0060).

## Trade-offs

**Where the gate lives: in `stage-gates.ts`, or in a module of its own?** In `stage-gates.ts`, next to the spike's gate, which it copies. A module of its own would hold three lines. This is also the simplest option.

**The section names.** The current bullet list becomes five headings: Steps, Old and new side by side, Behaviour test, Verification and Rollback. Headings are what the other gates check, so the gate stays one call to `sectionProblems`.

**Checking that the behaviour test stayed unchanged: a script or the review?** The review, as the spec decided. A script would have to know which test is the behaviour test and which commit is the swap. The review reads both from the migration plan and the diff.

## Costs

Negligible. One more document of at most 1 MiB is read, only for a change whose route has a migration plan.

## Conventions and decisions

Follows the conventions and ADRs. The ones that matter most here:

- **The stage gates** (ADR 0052 to 0055): the migration plan gets one like the others, and the template test covers its template.
- **Reading files a branch controls** (ADR 0060): `migration-plan.md` goes through the existing change-document reader.
- **Lead by logic, not by numbers** (ADR 0038): the convention says when and how to write the test, not how many.
- **Writing for people** (ADR 0061): the ADR and the template follow the writing convention.

One new decision, recorded in ADR 0062: a migration meant to keep behaviour first gets a behaviour test that passes on the old code and then on the new code unchanged, enforced by the stages.

**Deviation:** T-1 and T-3 are writing tasks and go to the `writing` task agent. T-2 is code and goes to the `code` agent.

## Tasks

### T-1: Write the convention in code-testing and core.md

- Files: `plugins/factory/skills/code-testing/SKILL.md`, `plugins/factory/conventions/core.md`
- Covers: AC-1, AC-2
- Verify: `bun run check`
- Depends on: none
- Parallel: yes
- Status: done

### T-2: Add the migration plan's gate to the route check

- Files: `plugins/factory/scripts/stage-gates.ts`, `plugins/factory/scripts/stage-gates.test.ts`, `plugins/factory/scripts/changes.ts`, `plugins/factory/scripts/changes.test.ts`
- Covers: AC-5
- Verify: `bun test plugins/factory/scripts/stage-gates.test.ts plugins/factory/scripts/changes.test.ts`, `bun run doctest` and `bun run check`
- Depends on: none
- Parallel: yes
- Status: done

### T-3: Teach triage, planning, build and review about migrations

- Files: `plugins/factory/skills/factory-triage/SKILL.md`, `plugins/factory/skills/factory-planning/SKILL.md`, `plugins/factory/skills/factory-build/SKILL.md`, `plugins/factory/skills/factory-review/SKILL.md`, `scripts/skill-templates.test.ts`
- Covers: AC-3, AC-4, AC-6, AC-7
- Verify: `bun test scripts/skill-templates.test.ts` and `bun run check`
- Depends on: T-2
- Parallel: no
- Status: in-progress

### T-4: Record the decision

- Files: `docs/decisions/0062-keep-behaviour-in-migrations.md`, `GLOSSARY.md`, `TODO.md`
- Covers: AC-8
- Verify: `bun run check`
- Depends on: T-1, T-3
- Parallel: no
- Status: pending

# Tasks: Keep behaviour the same in migrations, and write tests apart from the code

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
- Status: done

### T-4: Record the decision

- Files: `docs/decisions/0062-keep-behaviour-in-migrations.md`, `GLOSSARY.md`, `TODO.md`
- Covers: AC-8
- Verify: `bun run check`
- Depends on: T-1, T-3
- Parallel: no
- Status: done

### T-5: Make tests read as a specification in code-testing

- Files: `plugins/factory/skills/code-testing/SKILL.md`
- Covers: AC-11
- Tests: none: skill text only
- Verify: `grep -n "^## Tests that read as a specification" plugins/factory/skills/code-testing/SKILL.md` finds the section, the two moved bullets are no longer under "Unit and integration tests", and `bun run check` passes
- Depends on: none
- Parallel: yes
- Status: done

### T-6: Make comments say why in code-readability and code-documentation

- Files: `plugins/factory/skills/code-readability/SKILL.md`, `plugins/factory/skills/code-documentation/SKILL.md`
- Covers: AC-13
- Tests: none: skill text only
- Verify: `grep -n "^## Comments" plugins/factory/skills/code-readability/SKILL.md` finds the section, `code-documentation` names the three kinds of why and how they fit an export's doc comment, and `bun run check` passes on the change's branch after the merge and `bun run generate` (the description changes the catalog)
- Depends on: none
- Parallel: yes
- Status: pending

### T-7: Build each task with a test agent, a code agent and an arbiter

- Files: `plugins/factory/skills/factory-build/SKILL.md`, `scripts/skill-templates.test.ts`
- Covers: AC-9, AC-10
- Tests: the build skill's verification template, through `scripts/skill-templates.test.ts` › "AC-10: the verification template records the arbiter's rulings"
- Verify: the test agent's run of `bun test scripts/skill-templates.test.ts` fails on the new test only; after the skill text, it passes with the test file unchanged; `bun run check` passes
- Depends on: none
- Parallel: yes
- Status: pending

### T-8: Plan a test agent's input, and the behaviour test first

- Files: `plugins/factory/skills/factory-planning/SKILL.md`
- Covers: AC-6, AC-9
- Tests: none: skill text only; the existing template test keeps the tasks template passing its gate
- Verify: `bun test scripts/skill-templates.test.ts` passes, the tasks template shows a `Tests` line in each task, the tasks section has the migration rule, and `bun run check` passes
- Depends on: none
- Parallel: yes
- Status: pending

### T-9: Break the code in the review to see each criterion's test fail

- Files: `plugins/factory/skills/factory-review/SKILL.md`, `scripts/skill-templates.test.ts`
- Covers: AC-9, AC-12
- Tests: the review skill's review template, through `scripts/skill-templates.test.ts` › "AC-12: the review template records the mutation checks"
- Verify: the test agent's run of `bun test scripts/skill-templates.test.ts` fails on the new test only; after the skill text, it passes with the test file unchanged; `bun run check` passes
- Depends on: T-7
- Parallel: no
- Status: pending

### T-10: Record the decision for tests written apart from the code

- Files: `docs/decisions/0063-tests-written-apart-from-the-code.md`, `docs/decisions/0054-build-verify-and-spike.md`, `docs/decisions/0055-review-and-security-review.md`, `GLOSSARY.md`, `docs/readiness.md`, `TODO.md`
- Covers: AC-14
- Tests: none: documentation only
- Verify: ADR 0063 exists and names ADR 0054 and 0055 as amended, both have the Status line, `grep -n "^\*\*Test agent\|^\*\*Arbiter\|^\*\*Mutation check" GLOSSARY.md` finds three entries, and `bun run check` passes
- Depends on: T-5, T-6, T-7, T-8, T-9
- Parallel: no
- Status: pending

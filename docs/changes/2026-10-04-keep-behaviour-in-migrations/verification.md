# Verification: Keep behaviour the same in migrations, and write tests apart from the code

## Checks

- `bun run check` on `change/2026-10-04-keep-behaviour-in-migrations` after all four tasks were merged and the generated files regenerated: passed. That covers typecheck, lint, 492 tests, 101 doctest examples and validate.
- Each task's Verify command, run by its builder before committing:
  - T-1: `bun run check`;
  - T-2: the gate and route-check tests (134 pass), typecheck, lint and doctest; the bundle was regenerated after the merge;
  - T-3: `bun test scripts/skill-templates.test.ts` (7 pass) and `bun run check`;
  - T-4: `bun run check`.
- The new gate refuses nothing that exists: no change folder has a `migration-plan.md`.
- This change has no migration plan of its own, so the behaviour-test rules (AC-6, AC-7) are checked by reading the skills, not by a run.

- Second part of the build (AC-9 to AC-14), on `change/2026-10-04-keep-behaviour-in-migrations`, after each merge and `bun run generate`: `bun run check` passed every time. Final run: typecheck, lint, 496 tests, 101 doctest examples and validate, all passed.
- Red runs of the new split (T-7 and T-9, the only tasks with testable behaviour; T-5, T-6, T-8 and T-10 were `Tests: none`, skill or document text):
  - T-7: `bun test scripts/skill-templates.test.ts` on `change/…--T-7--tests` at commit `0b4e2d9`: 7 pass, 1 fail, "the template should have a `## Rulings` section". Re-run by the coordinator, same result. After the code agent's commit `a49274a`: 8 pass; `git diff` of the test file between the two branches was empty.
  - T-9: same command on `change/…--T-9--tests` at commit `db7d661`: 8 pass, 1 fail, "the template should have a `## Mutation checks` section". Re-run by the coordinator, same result. After the code agent's commit `c65ab24`: 9 pass; `git diff` of the test file between the two branches was empty.
- No test was disputed in this build, so no arbiter ran.

## Evidence

- AC-1: `plugins/factory/conventions/core.md`, the bullet "A migration meant to keep behaviour" under Tests
- AC-2: `plugins/factory/skills/code-testing/SKILL.md`, section "Migrations that keep behaviour", with its parts "Two forms", "When the old code can't run in a test" and "Comparing in production"
- AC-3: `plugins/factory/skills/factory-triage/SKILL.md`, the "+ migration-plan" deviation, which now covers code migrations that keep behaviour
- AC-4: the migration plan's template in `plugins/factory/skills/factory-planning/SKILL.md`, section "The migration-plan stage"; `scripts/skill-templates.test.ts` › "AC-4: the planning skill's migration plan template passes the migration plan gate"
- AC-5: `stage-gates.test.ts` › "AC-5: passes a migration plan with every section filled in", "AC-5: reports a missing %s section" and "AC-5: reports an empty %s section" (one case per section), "AC-5: reports every section of an empty document"; `changes.test.ts` › "AC-5: requires migration-plan.md, with its sections, once the migration-plan stage is done", "AC-5: ignores migration-plan.md while the migration-plan stage isn't done", "AC-5: refuses a done migration-plan stage whose migration-plan.md misses a section"
- AC-6: `plugins/factory/skills/factory-build/SKILL.md`, the paragraph "When the route has a migration plan" under "Before the first task"
- AC-7: `plugins/factory/skills/factory-review/SKILL.md`, point 7 of "What it checks", "The behaviour test, when the route has a migration plan", with a changed test as a high finding
- AC-8: `docs/decisions/0062-keep-behaviour-in-migrations.md`, and the glossary entries "Behaviour test (characterization test)" and "Golden master"
- AC-9: `plugins/factory/skills/factory-build/SKILL.md`, "Each task" steps 3 to 6 (the test agent, the red-run check, the code agent, the test-file diff) and "Special cases" for the quick track. Used on T-7 and T-9 (see the red runs under Checks)
- AC-10: `scripts/skill-templates.test.ts` › "the stage skills' templates > AC-10: the verification template records the arbiter's rulings"; the part "When the code agent disputes a test" in `factory-build/SKILL.md`
- AC-11: `plugins/factory/skills/code-testing/SKILL.md`, section "Tests that read as a specification"
- AC-12: `scripts/skill-templates.test.ts` › "the stage skills' templates > AC-12: the review template records the mutation checks"; the part "The mutation check" in `plugins/factory/skills/factory-review/SKILL.md`
- AC-13: `plugins/factory/skills/code-readability/SKILL.md`, section "Comments"; the internal-code bullet in `plugins/factory/skills/code-documentation/SKILL.md`
- AC-14: `docs/decisions/0063-tests-written-apart-from-the-code.md` (with the "Amended by" lines in ADR 0054 and 0055), and the glossary entries "Test agent", "Arbiter" and "Mutation check"

## Rulings

None.

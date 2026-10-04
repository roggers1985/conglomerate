# Verification: Keep behaviour the same during a migration

## Checks

- `bun run check` on `change/2026-10-04-keep-behaviour-in-migrations` after all four tasks were merged and the generated files regenerated: passed. That covers typecheck, lint, 492 tests, 101 doctest examples and validate.
- Each task's Verify command, run by its builder before committing:
  - T-1: `bun run check`;
  - T-2: the gate and route-check tests (134 pass), typecheck, lint and doctest; the bundle was regenerated after the merge;
  - T-3: `bun test scripts/skill-templates.test.ts` (7 pass) and `bun run check`;
  - T-4: `bun run check`.
- The new gate refuses nothing that exists: no change folder has a `migration-plan.md`.
- This change has no migration plan of its own, so the behaviour-test rules (AC-6, AC-7) are checked by reading the skills, not by a run.

## Evidence

- AC-1: `plugins/factory/conventions/core.md`, the bullet "A migration meant to keep behaviour" under Tests
- AC-2: `plugins/factory/skills/code-testing/SKILL.md`, section "Migrations that keep behaviour", with its parts "Two forms", "When the old code can't run in a test" and "Comparing in production"
- AC-3: `plugins/factory/skills/factory-triage/SKILL.md`, the "+ migration-plan" deviation, which now covers code migrations that keep behaviour
- AC-4: the migration plan's template in `plugins/factory/skills/factory-planning/SKILL.md`, section "The migration-plan stage"; `scripts/skill-templates.test.ts` › "AC-4: the planning skill's migration plan template passes the migration plan gate"
- AC-5: `stage-gates.test.ts` › "AC-5: passes a migration plan with every section filled in", "AC-5: reports a missing %s section" and "AC-5: reports an empty %s section" (one case per section), "AC-5: reports every section of an empty document"; `changes.test.ts` › "AC-5: requires migration-plan.md, with its sections, once the migration-plan stage is done", "AC-5: ignores migration-plan.md while the migration-plan stage isn't done", "AC-5: refuses a done migration-plan stage whose migration-plan.md misses a section"
- AC-6: `plugins/factory/skills/factory-build/SKILL.md`, the paragraph "When the route has a migration plan" under "Before the first task"
- AC-7: `plugins/factory/skills/factory-review/SKILL.md`, point 7 of "What it checks", "The behaviour test, when the route has a migration plan", with a changed test as a high finding
- AC-8: `docs/decisions/0062-keep-behaviour-in-migrations.md`, and the glossary entries "Behaviour test (characterization test)" and "Golden master"

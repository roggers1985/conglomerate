# Verification: Write documentation for people

## Checks

- `bun run check` on `change/2026-10-04-writing-for-people` after all five tasks were merged and the generated files regenerated: passed. That covers typecheck, lint, 476 tests, 100 doctest examples and validate, which includes the skills' frontmatter and the catalog.
- `bun test scripts/skill-templates.test.ts` passed both on the old templates and on the rewritten ones (6 tests).
- The template test catches a broken heading. The real plan template, with `## Costs` renamed to `## Cost` in memory, got the problem `plan.md has no "## Costs" section` from the plan gate. The template passes that gate unchanged.
- `bun plugins/factory/dist/changes.js check docs/changes/2026-10-02-pr-body/task.md` passed after the rewrite of that plan, with its plan gate.
- The rewritten pr-body plan was compared with the old one section by section (`git diff`). Every fact, file, number, ADR, finding number and task stayed. The only additions explain terms, such as what "pure" means. Three small claims the first rewrite added were removed after the review (review finding 10).

## Evidence

- AC-1: `plugins/factory/skills/writing-documentation/SKILL.md`, section "How to write", with three before-and-after examples; validated by `bun run check`
- AC-2: `plugins/factory/conventions/core.md`, the line under "Documentation" that points to the `writing-documentation` skill
- AC-3: the table "Who a document is for" in `plugins/factory/skills/writing-documentation/SKILL.md`, the only place that defines the locations. ADR 0061 records the decision and summarises the table; `CLAUDE.md` and `GLOSSARY.md` point to it.
- AC-4: the rewritten template guidance in `factory-intake` (intent, spec), `factory-planning` (plan, tasks), `factory-build` (verification), `factory-review` (review), and the report template in `plugins/factory/checkups/protocol.md`
- AC-5: `scripts/skill-templates.test.ts` › "AC-5: the intake skill's intent template passes the intent gate", "AC-5: the intake skill's spec template passes the spec gate", "AC-5: the planning skill's plan template passes the plan gate", "AC-5: the planning skill's tasks template passes the task list gate", "AC-5: the build skill's verification template passes the verification gate", "AC-5: the review skill's review template passes the review gate"; and the broken-heading check under Checks
- AC-6: `plugins/factory/skills/checkup-docs-drift/SKILL.md`, point 10 (hard-to-read documentation for people, each with a concrete suggestion), with small rewrites under "Fixes you may make yourself" and larger ones under "Always \"Needs a human\""
- AC-7: `docs/changes/2026-10-02-pr-body/plan.md`, rewritten; it passes its gate, and the comparison under Checks found no change in meaning
- AC-8: `docs/decisions/0061-writing-for-people.md`, and the glossary entries "Writing convention" and "Audience by location"

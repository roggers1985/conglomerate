# Plan: Write documentation for people

## Approach

First the convention, then everything that uses it.

1. **The convention comes first.** A new `writing-documentation` skill describes how to write for people, with short before-and-after examples. It also says who each kind of document is for, based on where it lives. `core.md` gets one line that points to it.
2. **Then the templates.** The skills that give a template for a document meant for people get their guidance rewritten in that style. Their headings stay exactly as they are, because the stage gates check them.
3. **A test guards the headings.** It takes every template from the skills and runs it through its stage gate. If a future edit breaks a heading, the test fails.
4. **The docs-drift checkup learns to spot hard-to-read text,** so existing documents improve over time.
5. **One worked example:** the plan of the pr-body change, rewritten without changing what it says.
6. **Finally, the decision is recorded** in an ADR and the glossary.

## Files and data

The work only touches text, skills and one test.

- New: `plugins/factory/skills/writing-documentation/SKILL.md`.
- Changed: `plugins/factory/conventions/core.md` (one line).
- Changed templates: the skills `factory-intake` (intent, spec), `factory-planning` (plan, tasks), `factory-build` (verification) and `factory-review` (review), and the report template in `plugins/factory/checkups/protocol.md`.
- Changed: `plugins/factory/skills/checkup-docs-drift/SKILL.md`.
- New test: `scripts/skill-templates.test.ts`, with the stage gates from `plugins/factory/scripts/stage-gates.ts`.
- Rewritten: `docs/changes/2026-10-02-pr-body/plan.md`.
- New: an ADR (0061), and entries in `GLOSSARY.md`. `CLAUDE.md` points to the audience rule.

No data or schema changes.

## Trade-offs

**Where the audience rule lives.** It could go in `CLAUDE.md`, the glossary or the new skill. I put it in the skill, because that's where someone writing a document looks. `CLAUDE.md` and the glossary point to it. That keeps it in one place, as the spec asks.

**Testing the templates.** Until now, templates were checked by hand. An automatic test costs a small file, and it keeps every future edit of a template honest. The simplest option, checking by hand again, would fail silently the first time someone forgets.

**Which agent writes.** The build skill names only the `code` agents. This work is writing for people, which `models.json` routes to the `writing` task type. I use that, and record it as a deviation.

## Costs

Negligible. This is text and one small test, which reads a handful of skill files of a few KB each.

## Conventions and decisions

This plan follows the conventions and ADRs. The ones that matter most here:

- **Lead by logic, not by numbers** (ADR 0038): the convention describes what makes text readable, with no word counts.
- **The stage gates stay intact** (ADR 0052 to 0055): headings and parsed words in templates don't change, and a test proves it.
- **The skill naming rule** (ADR 0013): `writing-documentation` belongs to the existing `writing` domain.

One new decision, recorded in ADR 0061: the writing convention, and the audience of a document by its location.

**Deviation:** the tasks go to the `writing` task agent instead of a `code` agent, because the work is writing for people.

## Tasks

### T-1: Write the writing-documentation skill and the core.md line

- Files: `plugins/factory/skills/writing-documentation/SKILL.md`, `plugins/factory/conventions/core.md`, `plugins/factory/CATALOG.md`
- Covers: AC-1, AC-2, AC-3
- Verify: `bun run check`, which validates the skill's name, frontmatter and the catalog
- Depends on: none
- Parallel: no
- Status: in-progress

### T-2: Rewrite the stage templates and test them against their gates

- Files: `plugins/factory/skills/factory-intake/SKILL.md`, `plugins/factory/skills/factory-planning/SKILL.md`, `plugins/factory/skills/factory-build/SKILL.md`, `plugins/factory/skills/factory-review/SKILL.md`, `scripts/skill-templates.test.ts`
- Covers: AC-4, AC-5
- Verify: `bun test scripts/skill-templates.test.ts` and `bun run check`
- Depends on: T-1
- Parallel: yes
- Status: pending

### T-3: Rewrite the checkup report template and teach docs-drift to spot hard-to-read text

- Files: `plugins/factory/checkups/protocol.md`, `plugins/factory/skills/checkup-docs-drift/SKILL.md`
- Covers: AC-4, AC-6
- Verify: `bun run check`
- Depends on: T-1
- Parallel: yes
- Status: pending

### T-4: Rewrite the pr-body plan as the first example

- Files: `docs/changes/2026-10-02-pr-body/plan.md`
- Covers: AC-7
- Verify: `bun plugins/factory/dist/changes.js check docs/changes/2026-10-02-pr-body/task.md` (the plan still passes its gate), and a side-by-side reading that nothing in it changed meaning
- Depends on: T-1
- Parallel: yes
- Status: pending

### T-5: Record the decision

- Files: `docs/decisions/0061-writing-for-people.md`, `GLOSSARY.md`, `CLAUDE.md`
- Covers: AC-8
- Verify: `bun run check`
- Depends on: T-1
- Parallel: no
- Status: pending

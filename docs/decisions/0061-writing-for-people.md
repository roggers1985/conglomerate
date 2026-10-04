# 61. Writing for people

Date: 2026-10-04

## Status

Accepted

Applies [ADR-0038](0038-safety-practices-from-power-of-10-and-tigerstyle.md): it describes what makes text readable, without numeric limits. Changes the templates of [ADR-0052](0052-intake-intent-and-spec.md), [ADR-0053](0053-planning-plan-tasks-and-the-convention-gate.md), [ADR-0054](0054-build-verify-and-spike.md) and [ADR-0055](0055-review-and-security-review.md) (the stage documents) and [ADR-0010](0010-recurring-checkups.md) (the checkup report), but not their headings.

## Context

Documentation the factory writes for people was hard to read. It had long sentences that carried several ideas. It put references to ADRs and files in the middle of the text, and the conclusion at the end of a paragraph. The plan of the pr-body change is an example (`docs/changes/2026-10-02-pr-body/plan.md`, before its rewrite).

This matters more as agents write more of the code. The owner doesn't read all of it. The documentation is how they keep an overview, so it has to be easy to read.

Nothing said how to write for people, or who a document is for. The templates in the factory's skills were written in the same dense style, and every document they produce copied it.

## Decision

**A writing convention.** Documentation for people follows the `writing-documentation` skill:

- what it's about and why, first;
- the conclusion at the start of a paragraph;
- short sentences, one idea per paragraph;
- plain words, with terms explained where they first appear;
- lists and tables for structure;
- references at the end of a point;
- no loss of precision: every number, name, path and condition stays.

The skill gives examples instead of numeric limits, such as words per sentence. A count invites counting instead of writing well (ADR 0038). `core.md` points to the skill in one line.

**The audience of a document follows from its location.** The skill holds the table of locations, and it is the only place that defines them. In short:

- documentation in `docs/`, and the repository's `README.md`, `GLOSSARY.md` and `TODO.md`, is for people first;
- instructions for agents are for agents first: `CLAUDE.md`, a change's `task.md`, and skills, conventions, agents, commands and checkup instructions, in the plugin or in a project's `.claude/`;
- generated files are out of scope.

Most documents are read by both, and text that is readable for people is also clearer for agents. A marker per file, such as an emoji or a frontmatter field, was rejected. The location already says it, and a marker can be forgotten or go stale.

**The templates follow it.** The guidance in every template for a document meant for people is written in this style: intent, spec, plan, tasks, verification, review and the checkup report. Their headings and the words a script parses stay exactly as they are. A test runs every stage template through its stage gate, so an edit that breaks a heading fails (`scripts/skill-templates.test.ts`). The checkup report has no gate, so it isn't tested.

**Maintained documents improve over time.** The docs-drift checkup reports documentation for people that is hard to read, each with a concrete rewrite. That covers documents that are still kept current, such as the README, the glossary, the readiness document and the architecture register. Historical documents (checkup reports, finished specs and plans) and accepted ADRs stay as they are. The pr-body plan was rewritten as the first example, with the same content.

## Consequences

- Documents for people get easier to read, starting with every new change's documents, because they start from the templates.
- Skills and conventions, written for agents first, stay concise. The convention doesn't require them to change.
- Code comments and TSDoc keep following `code-documentation`.
- Accepted ADRs aren't rewritten for style, just as they aren't rewritten for content (ADR 0001). New ADRs follow the convention.
- Readable can't become vaguer: a rewrite that drops a fact is wrong. The docs-drift checkup checks that for its own rewrites.

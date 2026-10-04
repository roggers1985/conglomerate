# Spec: Write documentation for people

## Problem

Documentation the factory writes for people is hard to read. The plan of the pr-body change is a good example: long sentences that carry several ideas, references to ADRs and files in the middle of the text, and the conclusion at the end of a paragraph instead of the start.

This matters more as agents write more of the code. The owner won't read all of it, so the documentation is how they keep an overview. It has to be easy to read.

## Current behaviour

There is no writing convention. The `writing` domain for skills exists, but has no skills yet.

The factory's skills contain templates for documents meant for people: intent, spec, plan, verification, review, ADRs and checkup reports. Their guidance is written in the same dense style. The stage gates check the templates' headings, so those headings can't change.

Who a document is for isn't written down anywhere. Most documents are read by both people and agents.

## Acceptance criteria

- **AC-1**: THE SYSTEM SHALL have a `writing-documentation` skill that describes how to write documentation for people: what and why first, short sentences, one idea per paragraph, terms explained where they first appear, lists and tables for structure, references at the end of a point, and no loss of precision.
- **AC-2**: THE SYSTEM SHALL say in `core.md`, in one line, that documentation for people follows that skill.
- **AC-3**: THE SYSTEM SHALL define the audience of a document by its location, written down once: `docs/` and `README.md` are written for people first, and `skills/`, `conventions/`, `agents/` and `task.md` for agents first.
- **AC-4**: WHEN a skill gives a template for a document meant for people, THE SYSTEM SHALL write the template's guidance in that style.
- **AC-5**: THE SYSTEM SHALL keep every heading that a stage gate checks exactly as it is, so every template still passes its gate.
- **AC-6**: WHEN the docs-drift checkup runs, THE SYSTEM SHALL also report documentation for people that is hard to read, with a concrete suggestion for each.
- **AC-7**: THE SYSTEM SHALL rewrite the plan of the pr-body change in the new style as the first example, without changing what it says.
- **AC-8**: THE SYSTEM SHALL record the convention and the audience rule in an ADR, and explain both terms in the glossary.

## Edge cases

- **Documents for both people and agents** (ADRs, specs, plans): they follow the convention. Readable for people is also clearer for agents.
- **Documents for agents first** (skills, conventions): they stay concise and direct. The convention doesn't require them to change.
- **Generated files** (`CATALOG.md`, bundles, notices): out of scope. They're rewritten by the generator.
- **Code comments and TSDoc:** keep following `code-documentation`. Its examples already lead with what a function does.
- **A template whose wording a script parses** (for example the "None." under Findings): the parsed words stay exactly as they are.

## Limits

No numeric limits. A word count per sentence would invite counting instead of writing well ("lead by logic, not by numbers", ADR 0038). The convention describes what makes text readable, with examples.

## Security

- Authentication: Public, because this change adds no entry point: it only changes documentation, skills and templates.
- Authorisation: none: no code runs differently.
- Untrusted input: none.
- Sensitive data: none.

## Out of scope

- Rewriting all existing documentation now. The docs-drift checkup will flag hard-to-read documents over time.
- A marker per file (an emoji or a frontmatter field) for the audience: the location decides, as the owner agreed.
- Documentation for agents (skills, conventions): no style change required.

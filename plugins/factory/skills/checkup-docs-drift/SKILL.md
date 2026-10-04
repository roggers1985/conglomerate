---
name: checkup-docs-drift
description: Documentation drift checkup. Verifies that CLAUDE.md, READMEs, ADRs, conventions, TODO lists, skills and code comments still match the code (commands, paths, env vars, packages, decisions), so people and agents are not misled. Use for "docs checkup", "is CLAUDE.md up to date", or when the checkup runner dispatches it.
metadata:
  intervalDays: 30
  priority: normal
  task: checkup
---

# Checkup: docs-drift

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Outdated instructions are worse than none: agents follow them. This checkup keeps the written guidance honest.

## In scope

1. **Agent instructions** (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, nested `CLAUDE.md` files): every command, script, path, package and env var they mention exists, and every description of the architecture or layout still matches the code.
2. **Conventions** (conventions files, the conventions sections of agent instructions): rules that the code consistently breaks are either fixed in the code (small cases) or raised as a question: is the rule still wanted?
3. **Decisions** (`docs/decisions/` or other ADRs):
   - accepted ADRs that the code contradicts;
   - statuses and "superseded by" links that are wrong or missing;
   - numbering gaps or duplicates.

   Accepted ADRs are never rewritten (see the protocol). Older ADRs may deliberately use names that a later ADR renamed; check that the renaming ADR exists, and don't report the old names as drift.
4. **Skills, commands, agents and hooks** (`.claude/`, and plugin folders if the project is a plugin): file paths, commands and script names they reference still exist.
   - For generated files (the project's `CLAUDE.md` says which), check that they are up to date by regenerating them, not by editing them.
5. **READMEs and docs** (`README.md`, `docs/**`): setup steps and commands work, and links and anchors resolve. Skip historical documents such as checkup reports and finished specs and plans; they describe the past on purpose.
6. **Environment variables**: `.env.example` (or the equivalent) matches the variables the code reads, in both directions.
7. **Glossaries** (`GLOSSARY.md` and similar): entries that no longer match the code, and concepts used in the docs or ADRs that have no entry yet.
8. **Task lists** (`TODO.md` and similar): items that are already done according to the code or git history, and items that no longer make sense.
9. **Code comments that state facts**: comments with numbers, dates or behaviour ("as of <date>", "N of M", "we do X because Y") that the code no longer matches.
10. **Documentation for people that is hard to read** (`docs/**`, `README.md`: the audience by location, as the `writing-documentation` skill defines it). Look for:
    - long sentences that carry several ideas;
    - the conclusion at the end of a paragraph instead of the start;
    - references (ADRs, files, links) in the middle of a sentence;
    - terms that aren't explained where they first appear;
    - prose where a list or table would do.

    Report each with a concrete suggestion: the rewritten sentence or the new structure. "Hard to read" alone is not a finding. A rewrite keeps every number, name, path and condition; one that drops a fact is wrong.

    Skip documents for agents first (`task.md` under `docs/`), accepted ADRs (never rewritten, see the protocol) and historical documents (see point 5).

## Fixes you may make yourself

- Correct paths, names, commands, links, env var lists and outdated facts in docs and comments.
- Remove task list items that are demonstrably done (cite the commit).
- Fix ADR status lines and links, as long as no decision changes.
- Small, clearly safe readability rewrites (point 10): split a sentence, move a conclusion to the start, move a reference to the end, explain a term. Every fact stays.

## Allowed production access

None.

## Always "Needs a human"

- Changing a convention, an architectural statement or an accepted decision. Propose a superseding ADR or a code fix instead.
- Task list items where it's unclear whether they're done or still wanted.
- Larger readability rewrites, such as a restructured section or prose turned into a table. Include the proposed text.

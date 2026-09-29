# 25. Checkup refinements after the first runs

Date: 2026-09-29

## Status

Accepted

Clarifies [ADR-0023](0023-complete-generic-checkups-and-project-overrides.md) on scheduling checkups that don't apply.

## Context

All 14 checkups of this repository ran for the first time on 2026-09-29, each in its own subagent. Their "About this checkup" sections, and a first `retro`, showed where the instructions fell short.

The most instructive failures:
- **Outdated context:** a checkup judged the owner's global `CLAUDE.md` from an outdated copy in its context, and reported a problem that no longer existed.
- **Removing what the owner asked for:** a checkup deleted helpers the owner had asked for, because nothing used them yet.
- **Miscounted branches:** the dispatching session twice miscounted the open checkup branches it listed by hand.

## Decision

- **Protocol:**
  - read files from disk rather than trusting file contents quoted in the context;
  - never remove or undo something the owner explicitly asked for, but propose it under "Needs a human";
  - also look at other checkups' unmerged branches;
  - `${CLAUDE_PLUGIN_ROOT}` means the plugin folder when a file is read directly.
- **Runner:** it injects the list of unmerged checkup branches with a command, and passes it on unchanged, so nobody counts or retypes it.
- **Skills,** each changed where its first run found a gap:
  - `security`: small surfaces get a short report, and it never proposes its own removal;
  - `code-quality`: gains conceptual consistency, turning recurring findings into lint rules or validator checks, and a fallback for tooling repositories;
  - `test-coverage`: explains why subprocess tests and doctests show as uncovered;
  - `new-features`: merges its two "deferred decisions" items;
  - `agent-setup`: a missing settings file is fine, it reads the global file from disk, and it makes the runner's suggestion judgement itself;
  - `unused-code`: exports kept for the doctest are used, and owner-requested helpers stay;
  - `claude-code-platform`: reads older release history through `gh`;
  - `retro`: lists branches itself, and knows what goes in its own "About this checkup".
- **Scheduling:** a checkup that clearly doesn't apply may be left out of the schedule entirely (e.g. the UI checkups in this UI-less repository). The "report not applicable and propose removal" route of ADR-0023 is for projects where it's unclear.
- **This repository's schedule:** `security` becomes a priority checkup.

## Consequences

- The same mistakes should not recur. The next `retro` checks that.
- Intervals stay unchanged: one run per checkup is not enough evidence to lengthen or shorten any of them.

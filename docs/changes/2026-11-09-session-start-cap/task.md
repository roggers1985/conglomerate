---
title: Keep the session-start output under the hook size cap
created: 2026-11-09
track: standard
classification:
  type: bug
  size: medium
  risk: moderate
  reversible: true
  uncertainty: low
  architectureDebt: []
stages:
  - { name: spec, level: guided, status: done }
  - { name: plan, level: trusted, status: done }
  - { name: build, level: trusted, status: done }
  - { name: verify, level: trusted, status: done }
  - { name: review, level: trusted, status: done }
  - { name: finish, level: trusted, status: in-progress }
deviations:
  - "+ verify: the fix can only be checked by starting a real session and seeing all parts arrive without \"Output too large\""
---

# Keep the session-start output under the hook size cap

The session-start hook prints 13,127 characters of `additionalContext`. Claude Code caps each hook string at 10,000 characters, so a session gets only a preview of about 2,000 characters and a file path. Most of `core.md`, the autonomy rules and the model routing table never arrive (found by the claude-code-platform checkup, `docs/checkups/claude-code-platform/2026-11-09.md`).

Why the standard track: medium size in one unit, and moderate risk because the change decides what every session receives.

Uncertainty is recorded as low because the schema only knows low and high: the solution is clear, and the one unknown (the scope of the cap) is checked in verify, not by a spike.

Decisions from triage:

- Split the output into three parts, each under the cap, with a test that checks it. The split into hook entries or script arguments is for the plan.
- `core.md` is not trimmed in this change (9,784 bytes, which fits). Trimming changes the owner's conventions, so it is a separate decision unless the owner asks for it in the spec.
- Open for the spec: whether the cap is per hook command or per event in total, since the checkups, toolbox and changes reminders add context too. The live check in verify settles it.
- The new ADR refines how ADR 0008, 0014 and 0044 deliver their content. It supersedes them only if the live check says it must.

The working tree had uncommitted doctest edits (ADR 0016, `doctest.ts` and its test, `dist/doctest.js`) when this branch was created. They are not part of this change and must not be committed with it.

# Spec: Keep the session-start output under the hook size cap

## Problem

Claude Code accepts at most 10,000 characters per string a hook returns as context. The factory's session-start hook returns 13,127 characters in one string, so a session receives only a preview of about 2,000 characters and a path to a file with the rest. The owner's conventions, the autonomy rules and the model routing table are then not in the session, although every other document says they are (ADR 0008, 0014, 0044). The claude-code-platform checkup found this on 2026-11-09 and reproduced it in a live session.

## Current behaviour

At session start the plugin's hooks print context for Claude. The first one prints a single block with three parts, in this order:

| Part | Content | Size today |
|---|---|---|
| Conventions | The owner's always-on conventions | 9,783 characters |
| Autonomy | The rules of the project's autonomy level (`guided`, `trusted` or `autonomous`), which the project sets in its settings | 1,411 characters at `trusted` |
| Model routing | Which model and effort each task type uses | 1,929 characters |

Together with the blank lines between them, that is 13,127 characters in one string. Three more hooks (checkups, toolbox, changes) each print their own short reminder, only when they have something to say. Claude Code truncates the large block, so most of it never arrives.

## Acceptance criteria

- **AC-1**: WHEN a session starts, THE SYSTEM SHALL deliver the conventions, the autonomy rules and the model routing table to Claude in full, with none of them truncated or replaced by a preview.
- **AC-2**: THE SYSTEM SHALL keep every string it returns as session-start context for the conventions, the autonomy rules and the model routing at most 10,000 characters long.
- **AC-3**: THE SYSTEM SHALL list the parts in the hook configuration in the order conventions, autonomy, model routing. Claude Code runs the hooks of one event in parallel, so the order in which the parts arrive is not ours to guarantee, and no part depends on another (amended in verify, after the live session delivered routing before autonomy).
- **AC-4**: THE SYSTEM SHALL keep the wording of each part unchanged by this change.
- **AC-5**: IF the project's autonomy level is `guided`, `trusted` or `autonomous`, THEN THE SYSTEM SHALL keep every string at most 10,000 characters long for that level.
- **AC-6**: IF a change to the conventions, the autonomy rules or the model routing makes a part longer than 10,000 characters, THEN THE SYSTEM SHALL fail its automatic checks, and the failure SHALL name the part and its length.
- **AC-7**: IF one part cannot be produced (for example the project's settings file is over 1 MiB; an invalid file falls back to the defaults and is reported, so it does not stop the part), THEN THE SYSTEM SHALL still deliver the other parts and SHALL tell the owner which part is missing and why.

## Edge cases

- **A part sits just under the cap** (the conventions are 9,783 characters, 217 under): covered by AC-2 and AC-6. The next edit that adds more than 217 characters fails the checks; what to cut is then the owner's decision.
- **A part grows past the cap:** AC-6. No part is cut or truncated automatically.
- **No project settings file, or an unknown autonomy level:** unchanged. The system behaves as it does today (AC-4 covers the text; the choice of level is not changed).
- **The cap turns out to apply to the sum of all hook output in an event and not to each string:** splitting does not help. This is checked in a real session in the verify stage. If it fails, stop and re-triage, because the fix is then to shorten the content and not to split it, and that changes the owner's conventions.
- **The other reminders (checkups, toolbox, changes) add context at the same time:** they keep their output as it is. Their own length is not part of this change unless the real session shows they count against the cap.
- **Missing permissions:** not applicable. The hook only reads files and prints.
- **Cancellation and concurrent use:** the hook is run by Claude Code, once per session start, and stops when it is interrupted, as today.

## Limits

- At most 10,000 characters per string, counted in characters as the language counts them. The cap comes from Claude Code and cannot be changed (checkup report 2026-11-09).
- Three parts today. Adding a fourth part is allowed if it also stays under the cap and has its own check.
- Past the limit, nothing is shortened silently: the automatic checks fail (AC-6).

## Security

- Authentication: none. The hook runs on the owner's machine, started by Claude Code.
- Authorisation: not applicable. It reads the plugin's own files and the project's settings and prints text.
- Untrusted input: the project's settings file is controlled by the project's branch. It is parsed with a schema where it is read, as today. This change adds no new input. What the hook prints goes into Claude's context, as today.
- Sensitive data: none.

## Out of scope

- Trimming or rewriting the conventions to gain headroom. Changing the owner's conventions is a separate decision.
- The text of the autonomy rules and of the model routing table.
- The checkups, toolbox and changes reminders, unless the real session shows that they count against the cap.
- Other Claude Code hook caps or limits.
- Publishing metadata and GitHub Copilot support, which the same checkup raised.

# 66. Session-start context in parts

Date: 2026-11-09

## Status

Accepted

Amends [ADR-0008](0008-deliver-owner-conventions-through-the-plugin.md), [ADR-0014](0014-model-routing.md) and [ADR-0044](0044-autonomy-levels.md). They say what the session-start hook delivers; this ADR says how: in three parts, each under the hook size cap.

## Context

Claude Code accepts at most 10,000 characters per string a hook returns as context. No setting raises this cap. A longer string is replaced by a preview of about 2,000 characters and a path to a file with the rest.

The session-start hook returned the conventions, the autonomy rules and the model routing table as one string of 13,127 characters. A session therefore saw only the start of the conventions, and never the autonomy rules or the routing table. The claude-code-platform checkup found this on 2026-11-09 and reproduced it in a live session (`docs/checkups/claude-code-platform/2026-11-09.md`, finding 1).

## Decision

The owner approved this with the change's spec and plan on 2026-11-09 (`docs/changes/2026-11-09-session-start-cap/`).

- **Three parts, in this order:** conventions (`core.md`), autonomy (the rules of the project's level) and routing (the model routing table). Their wording is unchanged.
- **One script, run three times.** `hooks/hooks.json` runs the session-start script once per part, with the part's name as its argument.
- **Each part is at most 10,000 characters.** A test renders every part at every autonomy level from the real files and fails when one is longer. The failure names the part, the level and the length.
- **The order of arrival is not guaranteed.** Claude Code runs the hooks of one event in parallel; a live session delivered routing before autonomy. The parts do not depend on each other, so `hooks.json` lists them in a fixed order for readability only.
- **A second test checks `hooks.json`.** It must list exactly one command per part, in the order above, so a part cannot be forgotten.
- **The parts fail independently.** Each reads only its own files. Only the autonomy part reads the project's settings, so a settings file it cannot read (one over 1 MiB, for example) stops that part alone, with an error that names it and the reason. The other two still arrive. Invalid settings do not stop it: they fall back to the defaults and are reported, as before.

## Alternatives considered

| Option | Why not |
|---|---|
| Shorten the content to fit one string | It needs 3,127 characters cut, about a quarter of the whole. That changes the owner's conventions and leaves no room to grow. |
| Three scripts, one per part | Three bundles, each inlining Zod (about 98 KB), for no gain over one script with an argument. |
| Deliver the parts through `CLAUDE.md` or skills | Changes how the conventions are delivered (ADR 0008) and what the plugin writes into a project. Much bigger, and not needed. |
| A run-time check that refuses a part over the cap | It would drop a whole part in a live session. The tests catch the problem earlier. |

## Consequences

- Every session, and every subagent that inherits its context, gets the full context of about 13 KB (about 3,300 tokens) instead of a 2 KB preview. That is the intended behaviour, but it is more context than before.
- `core.md` is 9,783 characters, only 217 under the cap. The next sizeable edit fails the test. What to cut is then the owner's decision.
- If the cap turns out to apply to the sum of all hook output at session start, and not to each string, the split does not help. The content must then shrink, which changes the owner's conventions and needs a new decision.

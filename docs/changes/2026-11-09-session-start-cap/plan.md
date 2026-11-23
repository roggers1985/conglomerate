# Plan: Keep the session-start output under the hook size cap

## Approach

Print the three parts as three separate hook outputs instead of one. The session-start script learns to print one part at a time: `conventions`, `autonomy` or `routing`. `hooks/hooks.json` runs it three times, once per part, in that order. Each run prints at most 10,000 characters, so Claude Code no longer truncates any of them. Nothing is cut or reworded (AC-4).

Each part reads only what it needs, so the parts also fail on their own (AC-7). The conventions part reads `core.md`. The routing part reads `models.json`. The autonomy part reads the project's settings and the rules of its level, and is the only one that can fail on a project's invalid settings. When it does, the script exits with an error that names the part and the reason, and Claude Code shows that to the owner while the other two parts still arrive.

The cap is checked by tests, not at run time (AC-2, AC-5, AC-6). One test renders every part for every autonomy level from the real files and expects each to be at most 10,000 characters. Its failure message names the part, the level and the length. A second test reads `hooks.json` and expects exactly one command per part, in order, so a part cannot be forgotten.

The unit touched is the factory plugin (`docs/architecture/factory.md`). The architecture register lists no open debt for it.

## Files and data

- `plugins/factory/scripts/session-start.ts`: the part names, the cap constant (10,000), a function that renders one part, and a `main` that takes the part as its first argument and the project folder as its second. The project folder was the first argument; `hooks.json` never passed one, so no caller breaks.
- `plugins/factory/scripts/session-start.test.ts`: the tests above, and the existing ones moved to the new shape.
- `plugins/factory/hooks/hooks.json`: the single session-start command becomes three.
- `plugins/factory/dist/session-start.js` (and the other bundles that `bun run generate` rebuilds): generated.
- `docs/decisions/0066-…md`: the new ADR. The status lines of ADR 0008, 0014 and 0044 get a link to it.
- `docs/architecture/factory.md`: one sentence saying the hook prints three parts.

Limits (from the spec): at most 10,000 characters per part; three parts. The part name is checked against the list of three and anything else exits with an error that lists the valid names.

## Trade-offs

- **Simplest option: shorten the content until it fits in one string.** It needs 3,127 characters cut, about a quarter of everything, and the conventions alone are only 217 under the cap. That changes the owner's conventions and leaves no room to grow. Not chosen; the spec rules it out of scope.
- **Chosen: one script with a part argument, run three times.** One bundle to build and ship, no copied code.
- **Three scripts, one per part.** Three bundles, each inlining Zod (about 98 KB each), for no gain. Not chosen.
- **Put the parts in `CLAUDE.md` or skills instead of the hook.** Changes how the conventions are delivered (ADR 0008) and what the plugin may write into a project. Much bigger, and not needed.
- **A run-time check that refuses a part over the cap.** It would drop a whole part in a live session. The tests catch the problem earlier, and the spec asks only for failing checks (AC-6). Not chosen.

## Costs

- **Context:** today a session gets about 2,000 characters of the conventions and a path. After the fix it gets all 13,127 characters, about 3,300 tokens, in every session and every subagent that inherits it. That is the intended behaviour, but it is more context in every session than today.
- **CPU and time:** three short `bun` processes instead of one, started together by Claude Code. Each reads one or two small files. A few tens of milliseconds each. Not measured; the verify stage can time it.
- **Disk and network:** none. The `dist/` bundle is regenerated (about 100 KB) and has the same size as before.

## Conventions and decisions

Follows the conventions and ADRs. Every file is read through `lib/files.ts` with the same limits and symbolic-link choices as now (ADR 0012, 0032, 0060). Exports get TSDoc with a tested example (ADR 0016). The part name from the command line is narrowed against the list of parts and not cast. Settings are still parsed with a schema (ADR 0020).

New decision, written as ADR 0066 during the build: the session-start context is delivered in separate parts, each under the hook size cap, with the cap checked by a test. It refines ADR 0008, 0014 and 0044, which say what is delivered but not how; it supersedes none of them.

Two things the build cannot settle and verify must: that Claude Code really delivers all three outputs in full, and in the order of `hooks.json` (AC-1, AC-3). If it does not, stop and re-triage (see the spec's edge cases).

## Tasks

### T-1: Print the session-start context one part at a time

- Files: `plugins/factory/scripts/session-start.ts`, `plugins/factory/scripts/session-start.test.ts`
- Covers: AC-2, AC-4, AC-5, AC-6, AC-7
- Tests: the exports of `plugins/factory/scripts/session-start.ts`: `SESSION_START_PARTS` (`["conventions", "autonomy", "routing"]`), `SESSION_START_CONTEXT_CHARACTERS_MAX` (10,000), `renderSessionStartPart(part, { projectDir, signal })` (returns the part's text as a promise, and rejects with an error that names the part when it cannot be produced) and `buildSessionStartOutput(context)` (wraps one part's text in the hook's JSON and refuses empty text); and the command `bun session-start.ts <part> <project folder>`. For each of the three parts and each of the three autonomy levels (set through the project's `.claude/factory.json`), the output is at most 10,000 characters, and the failure message names the part, the level and the length. The text of the conventions part equals the trimmed `core.md`, and the routing part equals the rendered routing table. With invalid settings, the autonomy part exits non-zero with a message that names the part, while the conventions and routing parts still succeed. An unknown part name exits non-zero.
- Verify: `bun test plugins/factory/scripts/session-start.test.ts`
- Depends on: none
- Parallel: no
- Status: done

### T-2: Run the three parts from the hook configuration

- Files: `plugins/factory/hooks/hooks.json`, `plugins/factory/scripts/session-start.test.ts`
- Covers: AC-1, AC-3
- Tests: the file `plugins/factory/hooks/hooks.json`. It contains exactly one session-start command for each part, in the order conventions, autonomy, routing, followed by the three existing reminder commands unchanged.
- Verify: `bun test plugins/factory/scripts/session-start.test.ts`
- Depends on: T-1
- Parallel: no
- Status: done

### T-3: Record the decision

- Files: `docs/decisions/0066-session-start-context-in-parts.md`, `docs/decisions/0008-deliver-owner-conventions-through-the-plugin.md`, `docs/decisions/0014-model-routing.md`, `docs/decisions/0044-autonomy-levels.md`, `docs/architecture/factory.md`
- Covers: none, because it is documentation of the decision
- Tests: none: documentation only
- Verify: `bun run validate`, and each of ADR 0008, 0014 and 0044 links to ADR 0066 in its status line
- Depends on: none
- Parallel: yes
- Status: done

### T-4: Regenerate the bundles and run every gate

- Files: `plugins/factory/dist/`, `plugins/factory/THIRD-PARTY-NOTICES.md` (only if `bun run generate` changes them)
- Covers: none, because it only rebuilds generated files
- Tests: none: generated files
- Verify: `bun run generate`, then `bun run check` passes and `git status` shows no other generated drift
- Depends on: T-1, T-2, T-3
- Parallel: no
- Status: done

## Deviations

- Review findings 1 to 4 were fixed by the coordinating session in one pass, not through the test agent and code agent in separate worktrees. They were small, and the review's mutation checks show each new test fails on the break it targets.

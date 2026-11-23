# Review: Keep the session-start output under the hook size cap

## Summary

The change does what the spec says when a project's settings are valid. The three parts arrive as separate hook outputs, each under the cap, with their wording unchanged and independent failures. The review found two criteria without evidence that held (AC-4 for the autonomy part, AC-7's reason) and an unbounded error list in the autonomy part (AC-2). All three are fixed, with tests. The AC-3 amendment was judged sound: Claude Code runs the hooks of one event in parallel.

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | high | The AC-4 test for the autonomy part stayed green when the "Factory settings" section was dropped. | `plugins/factory/scripts/session-start.test.ts` (Fix: the test now requires the part to end with the rendered settings section) | fixed |
| 2 | medium | The autonomy part had no size bound for invalid settings: 2,000 unknown keys gave 44,066 characters. | `plugins/factory/scripts/autonomy.ts` (Fix: at most ten problems of 200 characters each, then "and N more"; tests in `autonomy.test.ts` and `session-start.test.ts`) | fixed |
| 3 | medium | AC-7's "and why" had no test: removing the reason from the error stayed green. | `plugins/factory/scripts/session-start.test.ts` (Fix: the test asserts the size limit appears in stderr) | fixed |
| 4 | low | An empty part failed without naming the part. | `plugins/factory/scripts/session-start.ts` (Fix: the emptiness check moved into `renderSessionStartPart`) | fixed |
| 5 | low | `core.md` still says the autonomy level is set "at the end of these conventions"; the TSDoc said "prints them". | `plugins/factory/conventions/core.md:8` | accepted: `core.md` is the owner's and AC-4 keeps its wording; tracked in `TODO.md`. The TSDoc is fixed |
| 6 | low | ADR 0066 still treated a cap on the sum as open. | `docs/decisions/0066-session-start-context-in-parts.md` (Fix: recorded as settled, with the source) | fixed |
| 7 | low | The spec's example trigger for AC-7 was wrong. | `docs/changes/2026-11-09-session-start-cap/spec.md` (Fix: the example now names a settings file over 1 MiB) | fixed |
| 8 | low | A test only restated two constants, and `JSON.parse` results are used untyped in tests. | `plugins/factory/scripts/session-start.test.ts` | accepted: the restating test is removed; the untyped `JSON.parse` stays, since narrowing it in test code adds noise without catching anything |
| 9 | low | Test counts came from a checkout with unrelated edits. | `docs/changes/2026-11-09-session-start-cap/verification.md` (Fix: `main` is merged into the branch and `bun run check` passes on the clean tree (537 tests, 104 doctests, validate)) | fixed |

## Mutation checks

| Criterion | Test | What was broken | Result |
| --------- | ---- | --------------- | ------ |
| AC-2, AC-5, AC-6 | "AC-2, AC-5: keeps the conventions part within the cap at level …" | Appended the routing table to the conventions part. | failed |
| AC-4 | "AC-4: keeps the wording of the conventions part equal to the trimmed core.md" | Replaced the first newline of `core.md` with a space. | failed |
| AC-4 | "AC-4: keeps the wording of the routing part equal to the rendered routing table" | Renamed the routing heading. | failed |
| AC-4 | "AC-4: keeps the wording of the autonomy rules at level …" | Removed `renderSettingsContext(...)` from the autonomy part. | stayed green: finding 1 |
| AC-7 | "AC-7: still produces the conventions and routing parts when the settings cannot be read" | Made the routing part read the settings. | failed |
| AC-7 | "AC-7: tells the owner that the autonomy part is missing …" | Removed the part's name from the error. | failed |
| AC-7 | the same tests | Removed the reason from the error. | stayed green: finding 3 |
| AC-7 | "AC-7: tells the owner that the autonomy part is missing …" | Removed `process.exitCode = 1`. | failed |
| AC-7 | "AC-7: exits non-zero and names the part when the part is unknown" | An unknown part falls back to `conventions`. | failed |
| AC-7, AC-4 | "AC-4: keeps the default level guided when the settings are malformed JSON" | Ignored the project folder argument. | failed |
| AC-7 | "AC-7: refuses empty text, …" | Weakened the empty-text assert. | failed |
| AC-1, AC-3 | "AC-1: runs one session-start command per part …", "AC-3: orders the parts …" | Swapped two commands in `hooks.json`. | failed |
| AC-1, AC-2 (delivery) | the live session in `verification.md` | Nothing; only a live session shows what arrives. | skipped: no automated test can show delivery |

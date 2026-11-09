# Verification: Keep the session-start output under the hook size cap

## Checks

- T-1 red run: `bun test plugins/factory/scripts/session-start.test.ts` on `d833795`: the file fails at load, 0 tests run, because the exports `renderSessionStartPart` and the others the task adds do not exist yet
- T-1 merged (`35080da`), bundles regenerated: `bun run check` passed (532 tests, 104 doctests, validate). The test file got a lint fix from a test agent in `388e6a8` after the code agent's commit; it changes how the spawned environment is built, not what is asserted.
- T-2 red run: `bun test plugins/factory/scripts/session-start.test.ts` on `cb8d8a4`: 3 tests failed on assertions (hooks.json has one session-start command without a part argument), 32 passed
- T-2 merged (`ff53f10` via merge), bundles regenerated with no change: `bun run check` passed (535 tests, 104 doctests, validate)
- T-3 merged (`0c81e1d`, ADR 0066 and back-links); T-4: `bun run generate` produced no further change and `bun run check` passed (535 tests, 104 doctests, validate)
- Live session (`claude -p --plugin-dir plugins/factory --output-format stream-json --verbose --include-hook-events`, Claude Code 2.1.310, in an empty project folder): the three session-start hooks answered with 9,954, 2,028 and 1,261 characters of JSON, exit 0, none containing "Output too large". Claude reported seeing the conventions, the autonomy section and the model routing in full. The cap applies per string: 13 KB in total arrived.
- Live order: the responses came in the order conventions, routing, autonomy, and not in the order of `hooks.json`. The hooks of one group run in parallel, so the order of delivery is Claude Code's, not ours (AC-3, see Evidence).

## Evidence

- AC-1: `session-start.test.ts` › "AC-1: runs one session-start command per part, each with the part as its first argument"; and the live session above, where all three parts arrived in full
- AC-2: `session-start.test.ts` › "AC-2" tests (every part at every autonomy level is at most 10,000 characters); and the live session above
- AC-3: `session-start.test.ts` › "AC-3: orders the parts conventions, autonomy, routing in the hook configuration" covers the configuration only. **Not met as written:** the live session delivered routing before autonomy. Needs the owner's decision (see the reply)
- AC-4: `session-start.test.ts` › "AC-4" tests (each part equals the file or rendered text it comes from)
- AC-5: `session-start.test.ts` › "AC-2 and AC-5" tests (three levels, nine part and level pairs, as library calls and as commands)
- AC-6: the failure message of those tests names the part, the level and the length
- AC-7: `session-start.test.ts` › "AC-7" tests (a settings file over 1 MiB stops only the autonomy part, with an error that names it)

## Rulings

- T-1, the AC-7 tests on malformed settings (`403c0ea`): the test is wrong. An invalid `.claude/factory.json` falls back to the defaults and reports its errors, so the autonomy part still succeeds; only a settings file over 1 MiB makes it fail. The test agent corrected the tests in `d833795`. The spec's example for AC-7 ("the project's settings are invalid") names the wrong trigger; the criterion itself is unchanged. To bring to the owner at review.

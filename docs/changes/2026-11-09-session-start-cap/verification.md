# Verification: Keep the session-start output under the hook size cap

## Checks

- T-1 red run: `bun test plugins/factory/scripts/session-start.test.ts` on `d833795`: the file fails at load, 0 tests run, because the exports `renderSessionStartPart` and the others the task adds do not exist yet
- T-1 merged (`35080da`), bundles regenerated: `bun run check` passed (532 tests, 104 doctests, validate). The test file got a lint fix from a test agent in `388e6a8` after the code agent's commit; it changes how the spawned environment is built, not what is asserted.
- T-2 red run: `bun test plugins/factory/scripts/session-start.test.ts` on `cb8d8a4`: 3 tests failed on assertions (hooks.json has one session-start command without a part argument), 32 passed

## Rulings

- T-1, the AC-7 tests on malformed settings (`403c0ea`): the test is wrong. An invalid `.claude/factory.json` falls back to the defaults and reports its errors, so the autonomy part still succeeds; only a settings file over 1 MiB makes it fail. The test agent corrected the tests in `d833795`. The spec's example for AC-7 ("the project's settings are invalid") names the wrong trigger; the criterion itself is unchanged. To bring to the owner at review.

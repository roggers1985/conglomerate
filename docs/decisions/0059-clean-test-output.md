# 59. Clean test output

Date: 2026-10-02

## Status

Accepted

Extends [ADR-0031](0031-extensive-tests-and-css-modules.md) and [ADR-0048](0048-fail-fast.md).

## Context

A test run that prints warnings, logs and stack traces trains people to ignore its output, and the one warning that matters drowns in the rest. Unexpected output usually means something is wrong: a code path that logs an error nobody asserted, a rejected promise nobody awaited, a subprocess writing to the terminal, a temporary folder or a timer that is never cleaned up.

Failing fast (ADR 0048) already says a problem should stop the work at the earliest point that sees it. Noise in a test run is a problem that nothing stops. The extensive tests (ADR 0031) make it more likely: the more tests, the more noise.

## Decision

- **Test output is clean:** nothing but the test runner's report. Everything a test causes is expected and asserted, or it is a bug.
- **Console output** (`log`, `info`, `warn`, `error`, `debug`) is captured with a spy and asserted. Output that no test claimed fails the test.
- **Subprocesses** always have stdout and stderr captured and asserted, never left to print.
- **Unhandled rejections and uncaught errors** fail the test.
- **Nothing leaks:** temporary files and folders are removed, timers, servers and listeners closed, environment variables and globals restored, and the network mocked.
- **Enforced by the test setup, not by discipline.** The `code-testing` skill says how per framework: Bun (a `preload` setup file), Vitest (`vitest-fail-on-console`, MIT) and Jest (`jest-fail-on-console`, MIT). Adding a dependency stays the owner's decision per project (ADR 0035).
- **In this repository:** `test/setup.ts`, loaded through `bunfig.toml`, captures the console around every test and fails the test with what was left over, one line per call, naming the test and its file (`console.warn at ex/helper.ts:2:13 in test "parsing › calls a helper" (ex/x.test.ts:3:30): "…"`: the code that logged, when it is not the test itself, then the test's name and the test file's line and column); long messages are cut at a stated limit. Bun does not expose the current test's name to `afterEach`, so the name is read from the test file's source (`lib/test-name.ts`: the nearest enclosing `it(`/`test(` with a string-literal name, plus its `describe(` names, found by indentation within a bounded number of lines); a computed name shows as `<name not found>`, never silently left out. `lib/console-capture.ts` holds the capture (`ConsoleCapture`) and `expectConsole` for tests that expect output. `test/setup.test.ts` proves the enforcement by running fixture tests in a subprocess with both streams captured and asserted. The preload also applies to the doctests, which run inside the project folder.
- **A line in `core.md`** and a check in the `test-coverage` checkup, which runs the suite and reports anything beyond the runner's report.

## Consequences

- A test that logs fails until its author asserts the output or removes it. Existing tests were already quiet, so nothing had to change.
- Tests of code that prints get one more line (`expectConsole`), which also documents the output.
- Leaks are not detected automatically in this repository: the setup enforces console output, while Bun's own failure on unhandled errors covers those. File and timer leaks are covered by the rule and the checkup, not by a mechanism.
- A test that needs the real `console` (e.g. to run a CLI in-process and watch its output) has to assert it with `expectConsole` like any other output.

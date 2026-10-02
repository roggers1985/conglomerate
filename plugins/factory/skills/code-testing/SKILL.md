---
name: code-testing
description: The owner's testing conventions. Covers what to test at which level (unit, integration, component, end-to-end), finding edge cases systematically, Testing Library, Playwright, test data, mocking and flakiness. Use when writing, reviewing or fixing unit, integration, component or end-to-end tests, or when deciding which tests a change needs.
---

# Testing conventions

Every feature ships with tests, even when not explicitly asked. Tests are extensive, and they test *behaviour*: what a user or caller can observe, never how the code does it internally.

## Which tests at which level

| Level | Covers | Tools |
|---|---|---|
| **Unit** | Every function with logic, and **every edge case** (see below) | The project's test runner (e.g. `bun test`, Vitest) |
| **Integration** | Modules working together with their real collaborators: parsing → logic → storage, API handlers with their validation | The same runner; real code, only the outer edges replaced |
| **Component** | The largest possible part of the UI surface: every interactive component, its states, keyboard use and accessibility | Testing Library with `user-event` (see `code-accessibility`) |
| **End-to-end** | Every key user flow's happy path, plus its **critical failure paths** | Playwright |

Most tests are unit and component tests; end-to-end tests are fewer and focus on flows. A bug found at a higher level also gets a test at the lowest level that can reproduce it.

## Finding edge cases systematically

"Every edge case" needs a method, otherwise it stays a feeling. For each input:

1. **Equivalence classes**: group the inputs that should behave the same, and test one of each group, including the invalid groups.
2. **Boundaries**: test at and on both sides of every boundary: 0, 1, many; empty and full; minimum and maximum; just over a limit.
3. **The checklist**:
   - empty string, empty collection, a single element, duplicates;
   - missing values at the boundaries (`null` and `undefined` where the input allows them);
   - unicode, emoji, very long strings, whitespace-only strings;
   - dates: time zones, daylight-saving changes, leap years, month ends;
   - numbers: negative, zero, fractions, very large, `NaN`;
   - invalid input to parsers: wrong types, unknown fields (see `code-parsing`);
   - errors from dependencies (network failure, timeout, a rejected promise);
   - cancellation: an abort before, during and after the work (see `code-cancellation`);
   - concurrency: the same action twice at once, out-of-order responses.
4. **Property-based tests** (e.g. `fast-check`) for pure functions with large input spaces, such as parsers, formatters and calculations. State the property ("parse(format(x)) equals x", "the result is always sorted"), and let the tool find the counterexample.

## Unit and integration tests

- One behaviour per test, named after it: `it("rejects a name that is not kebab-case")`.
- Arrange, act, assert, with a blank line between the parts.
- **Mock only at the edges**: the network (e.g. MSW), the clock (fake timers), randomness (a seed), the file system (a temporary directory). Never mock the project's own modules; a test that mocks its collaborators tests the mock.
- **Test data**: small builder functions with sensible defaults (`buildJob({ title: "…" })`), so each test only states what matters to it.
- **Clean output**: no console output, subprocess output, unhandled errors or leaked resources that the test did not expect and assert (see "Clean test output").
- Deterministic: no wall clock, no real network, no dependence on test order or shared state.

## Component tests (Testing Library)

- Query as a user would: by role and accessible name, label, and text. Never by class name, test id (unless there is no accessible alternative), or DOM structure.
- Interact with `user-event`, not `fireEvent`.
- Cover every state a user can see: loading, empty, error, success, disabled, and pending async buttons.
- Include keyboard use and accessibility checks for interactive components (`code-accessibility`).

## End-to-end tests (Playwright)

- **Happy paths**: every key user flow, end to end.
- **Critical failure paths**: validation errors, missing permissions or a logged-out user, a failing payment or external service, and not-found pages.
- An axe accessibility scan on every page the flows visit (`@axe-core/playwright`).
- Locate by role and name (`getByRole`), never by CSS selectors. Rely on Playwright's automatic waiting; never `waitForTimeout`.
- Assert with Playwright's web-first assertions (`await expect(locator).toBeVisible()`), never on a value you read first (`expect(await locator.isVisible()).toBe(true)`): the former waits and retries, the latter checks once.
- Run against a production build, with isolated test data per test, so tests can run in parallel.
- Visual comparison screenshots only where the visual result *is* the feature, e.g. a chart or a generated image.

## Clean test output

A test run prints nothing but the test runner's report (ADR 0059). Everything a test causes is either expected and asserted, or a bug. Noise teaches people to ignore output, and the one real warning drowns in it.

- **Console output, warnings and errors** (`console.log/info/warn/error/debug`) are captured with a spy and asserted: "this test expects exactly this warning". Code that deliberately prints is tested by asserting what it printed. Output that nobody asserted fails the test.
- **Subprocesses** always have both stdout and stderr captured (`pipe`) and asserted. Never `inherit` them, and never leave them to print.
- **Unhandled rejections and uncaught errors** fail the test during which they happen. Never ignore, filter or log them.
- **Nothing leaks.** A test cleans up what it created: temporary files and folders are removed, timers cleared, servers and listeners closed, subscriptions and child processes stopped, environment variables and globals (including spies) restored, and the network mocked (see above). Do the cleanup in `afterEach` or `finally`, so it also runs when the test fails.
- Fix the cause instead of silencing it: a warning from your own code is a bug to fix; a warning from a dependency is a bug to fix or to assert with a comment on why it is expected.

### Enforcing it

Do not rely on discipline: let the test setup fail the test. A project sets this up once, in the setup file its runner loads before every test.

- **Bun**: a setup file in `bunfig.toml`, `[test] preload = ["./test/setup.ts"]`. It spies on the console methods in `beforeEach`, and in `afterEach` throws when a captured call was not asserted. This repository does it: `test/setup.ts`, with `lib/console-capture.ts` and its `expectConsole("warn", /pattern/)`. A preload applies to every `bun test` started in the project folder, doctests included. `bun test` already fails the test on an unhandled rejection or uncaught exception.
- **Vitest**: the `vitest-fail-on-console` package (MIT), called in a `setupFiles` entry; it fails a test on `console.warn`/`error` (and `log` and others when enabled), and a test that spies on the method (`vi.spyOn(console, "warn").mockImplementation(() => {})`) and asserts the call is left alone. Without the package, `onConsoleLog` returning `false` only hides output, so it does not enforce anything; have it throw instead, or fail the run. Vitest reports unhandled errors itself and exits with a failure.
- **Jest**: the `jest-fail-on-console` package (MIT), called in a `setupFilesAfterEnv` file, with the same spy-and-assert pattern.
- **Other languages**: the same rules with the language's own tools, e.g. `capsys` and `-W error` (warnings become errors) in pytest. Treat any output beyond the runner's report as a failure.

Adding a dependency stays the owner's decision per project (the license policy in the core conventions). Both packages above pass it, but ask before adding one; a project can also write the setup file itself, as this repository does.

## Flaky tests

A flaky test is a bug. Fix its cause (time, order, shared state, a missing wait on a real condition) instead of retrying it. Never skip or weaken a test to make a change pass.

## What not to do

- Assertions on implementation details: private functions, call counts of our own code, class names, element counts.
- Large snapshot tests: nobody reviews them, so they approve every change. Small, stable snapshots of a formatted string are fine.
- Chasing a coverage number. Coverage shows what isn't tested; it doesn't prove that what is tested is tested well. Mutation testing (e.g. Stryker) measures that, and is worth considering for critical code.

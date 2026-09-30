---
name: checkup-test-coverage
description: Test coverage checkup. Measures coverage, finds the riskiest untested behaviour (error paths, cancellation, invalid input, UI accessibility), and improves test quality according to the owner's testing conventions. Use for "test checkup", "coverage checkup", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: test-coverage

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Makes sure the behaviour that matters is tested, and that the tests are good. A higher coverage number is a side effect, not the goal.

## In scope

1. **Measure**: run coverage (`bun test --coverage`, `vitest --coverage`, `go test -cover`, `pytest --cov`, …) per package or workspace. Compare with the previous report.
2. **Untested behaviour, riskiest first**:
   - public functions without tests;
   - error paths;
   - cancellation, with an abort test per cancellable function (see `code-cancellation`);
   - parsing with invalid input (see `code-parsing`);
   - interactive UI without behaviour and accessibility tests (see `code-accessibility`).
   Start with money, data writes and security-relevant code.
3. **Test quality** (see `code-testing`):
   - tests of implementation details;
   - assertions that prove nothing;
   - tests that depend on each other, on order, on the wall clock or on the network;
   - mocks so heavy the test only tests the mock.
4. **Documentation examples**: exported code has examples that run as tests (see `code-documentation`), and the doctest runs in the project's checks.

## How to work

- Prefer a few tests for important behaviour over many trivial ones.
- When a test finds a bug, fix it only when the fix is small and clearly correct; otherwise it goes under "Needs a human" (see below).

## Reading coverage numbers

- Coverage tools only see code that runs in the test process. Code tested by spawning it as a subprocess (command-line entry points) and code run by documentation examples (doctest) shows as uncovered even when it is tested. Check for such tests before reporting a gap.

## Fixes you may make yourself

- Add tests for the most important untested behaviour, and improve weak tests, without weakening what they check.

## Allowed production access

None.

## Always "Needs a human"

- A test that reveals a bug whose fix changes behaviour: describe the bug with a reproduction in the report, instead of committing a failing test.
- Adding test tooling (a coverage tool, a browser test runner).

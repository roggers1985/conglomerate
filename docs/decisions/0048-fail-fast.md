# 48. Fail fast

Date: 2026-09-30

## Status

Accepted. Extended by [ADR-0059](0059-clean-test-output.md): test output is clean, so noise in a test run fails the test.

Extends [ADR-0038](0038-safety-practices-from-power-of-10-and-tigerstyle.md).

## Context

The owner prefers failing fast. Most of it was already covered, spread over several rules:
- assertions (ADR 0038);
- bounds that fail loudly (ADR 0032);
- no swallowed errors (ADR 0038, 0041);
- parsing at the boundary (ADR 0020);
- the strict type checker (ADR 0004).

It was never named as a principle, though, and three cases were missing:
- configuration checked late;
- defaults that hide invalid values;
- `switch` statements that silently miss a newly added case.

There is also a real tension. Sometimes falling back is right, and the factory itself does it: an invalid autonomy file falls back to `guided` (ADR 0044).

## Decision

- **A "Fail fast" section in `code-safety`, and a line in `core.md`:** a problem stops the work at the earliest point that can see it, loudly.
- **Configuration is checked at startup,** not at first use.
- **A default is for "not provided", never for "invalid".** A `catch` returns a fallback only for the one expected failure.
- **The compiler checks exhaustiveness:** every `switch` over a union handles every case. This is enforced by Biome's `useExhaustiveSwitchCases`, an experimental rule that reports nothing in this repository (it has no `switch` statements) and fires on a sample.
- **Fail fast versus fail safe:** failing is the default. Falling back is allowed only where failing would do more harm, always to the safe side, loudly. A fallback that grants more (access, autonomy, fewer checks) is never allowed.

## Consequences

- One principle ties the existing rules together, so each of them reads as part of a whole.
- One more experimental lint rule; the outdated-packages and new-features checkups watch for renames.

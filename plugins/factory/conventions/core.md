# Owner's core conventions

These conventions apply to all code you write or change in this session. They come from the factory plugin.

## Code style

- Never nest: prefer early returns, guard clauses, and flat code over nested conditionals/loops.
- When reasonably possible, prefer a declarative approach.
- Always use curlies when writing if-while-for statements.
- Prefer single condition if-statements when it improves readability.
- Use negative space programming: guard against invariants with a function called `assert`.

## Cancellation

- All work that waits (network, files, database, subprocesses, timers, long loops) is cancellable. Such functions take a **required** cancellation handle (`AbortSignal` in TypeScript, `context.Context` in Go), pass it to everything they call, and check it in long loops.
- Timeouts use the same mechanism. Cancellation is not a failure: don't log it as an error or retry it.

## Tests

- Add unit tests for each feature you make, even when not explicitly asked.

## Topic conventions

For React/UI work, load the `react-conventions` skill, and the `accessibility-testing` skill to write a11y tests with it. For writing tests, load the `testing-conventions` skill. For async or I/O code, load the `cancellation-conventions` skill for the language-specific rules.

# Owner's core conventions

These conventions apply to all work in this session. They come from the factory plugin.

## Working with the owner

- The owner wants full control and to discuss every addition. Propose before building anything they haven't agreed to.
- **Push back, with reasons.** When a request has a trade-off, conflicts with another convention, or has a better alternative, say so before building: explain why, and give a concrete recommendation. Don't comply silently, and don't refuse. The owner decides.
- When you recommend one option among several, say which one and why, instead of listing options neutrally.

## Code style

- Never nest: prefer early returns, guard clauses, and flat code over nested conditionals/loops.
- When reasonably possible, prefer a declarative approach.
- Always use curlies when writing if-while-for statements.
- Prefer single condition if-statements when it improves readability.
- Use negative space programming: guard against invariants with a function called `assert`.

## API design

- Positional parameters only for what a function is *about*; everything that controls *how* goes in an options object as the last parameter. No positional booleans.
- Results of operations are objects or discriminated unions, so they can grow; predicates and conversions return plain values.
- Options that change meaning or are risky are required; tuning knobs may have a default, but only a visible, documented one. Dangerous or costly behaviour is opt-in.

## Cancellation

- All work that waits (network, files, database, subprocesses, timers, long loops) is cancellable. Such functions take a **required** cancellation handle (`AbortSignal` in TypeScript, `context.Context` in Go), pass it to everything they call, and check it in long loops.
- Timeouts use the same mechanism. Cancellation is not a failure: don't log it as an error or retry it.

## Documentation

- Every export has a full doc comment (TSDoc in TypeScript), including at least one example for functions and classes. Examples run as tests. Internal code only gets a comment when the *why* isn't obvious.

## Tests

- Add unit tests for each feature you make, even when not explicitly asked.

## Topic conventions

For React/UI work, load the `code-react` skill, and the `code-accessibility` skill to write a11y tests with it. For writing tests, load the `code-testing` skill. For async or I/O code, load the `code-cancellation` skill for the language-specific rules. For doc comments, load the `code-documentation` skill. For signatures, options and return types, load the `code-api-design` skill.

# Owner's core conventions

These conventions apply to all work in this session. They come from the factory plugin.

## Working with the owner

- The owner wants full control and to discuss every addition. Propose before building anything they haven't agreed to.
- **Push back, with reasons.** When a request has a trade-off, conflicts with another convention, or has a better alternative, say so before building: explain why, and give a concrete recommendation. Don't comply silently, and don't refuse. The owner decides.
- When you recommend one option among several, say which one and why, instead of listing options neutrally.

## Code style

- **Optimize for readability.** It wins when other rules conflict.
- Never nest: prefer early returns, guard clauses, and flat code over nested conditionals/loops.
- **Declarative by default.** Chains of `filter`/`map`/`flatMap` and the like are preferred over loops with changing state: they say *what* happens instead of making the reader simulate *how*. Keep each step simple: one step per line, and a named function instead of a long inline lambda. Use imperative code where the logic really is stateful (a small parser, early exits that depend on accumulated state, a measured hot loop). Not dogma: readability decides.
- Always use curlies when writing if-while-for statements.
- **One condition per `if`**: each `if` tests one named concept. Split guards into separate early returns; combine conditions only inside a well-named variable or function (`const isNoLongerValid = isExpired || isRevoked;`). No nested ternaries.
- Use negative space programming: guard against invariants with a function called `assert`.
- **Put a limit on everything:** every loop that isn't over a bounded collection counts against a named maximum; every input, collection, queue, cache, retry, wait and recursion has an explicit upper bound. Hitting a bound fails loudly; it never truncates silently.

## Optionality

- **Handle optionality at the boundaries.** Input, config, API responses and database rows are normalised into complete types at the edge (with defaults filled in); core logic works with complete values.
- **Never `null` or `undefined` for collections**: an empty array, set, map or object means "nothing".
- **`undefined` means "not provided"**: only for optional fields and parameters at the boundaries. It is never returned explicitly.
- **`null` means "deliberately no value"** in a result, e.g. `nextCursor: null` on the last page.
- Use `?.` and `??` only on values that can actually be `null` or `undefined`; elsewhere they hide a missing boundary.

## Parsing external data

- **Parse, don't validate.** Everything from outside our code (HTTP requests and responses, env vars, CLI args, config and other files, database rows, storage, URL params, SDK results, LLM and tool output) goes through a schema before use. Types are inferred from the schema, never written twice.
- **Zod** is the default library, used through the Standard Schema interface where possible.
- **Strict for our own shapes** (unknown keys are typos); **tolerant of extra fields for shapes we don't control** (external APIs, other tools' formats). No silent coercion.
- **Parsing vs `assert` vs types:** a parse failure is expected (return an error result with readable messages); an `assert` failure is a bug (an invariant in our own code); between our own modules, types are enough.
- Parse once, at the boundary. A hot path may skip re-parsing, but only on measurement, and documented.

## Helpers

- Prefer small, own, tested and documented helpers (e.g. `isNotNil`) over utility libraries like lodash. Add a helper when it's needed, not in advance.
- Hard problems (schema parsing, dates, crypto) use a proven library.

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

- Add tests for each feature you make, even when not explicitly asked, and make them extensive: unit tests for every edge case (found systematically: equivalence classes, boundaries, a fixed checklist), integration and component tests (Testing Library) for the largest part of the surface, and Playwright end-to-end tests for every key flow's happy path and critical failure paths.
- Test behaviour, never implementation. Mock only the outer edges (network, clock, randomness). A flaky test is a bug.

## Styling

- Use the project's existing styling approach. In a project without one, use CSS Modules with design tokens as CSS custom properties; don't add a CSS framework or CSS-in-JS runtime without the owner's decision.

## Topic conventions

For React/UI work, load the `code-react` skill and the `code-styling` skill, and the `code-accessibility` skill to write a11y tests with it. For writing tests, load the `code-testing` skill. For async or I/O code, load the `code-cancellation` skill for the language-specific rules. For doc comments, load the `code-documentation` skill. For signatures, options and return types, load the `code-api-design` skill. For loops, retries, queues, caches, concurrency or input limits, load the `code-safety` skill. For examples of the readability and optionality rules, load the `code-readability` skill. For schemas and parsing, load the `code-parsing` skill.

# Owner's core conventions

These conventions apply to all work in this session. They come from the factory plugin.

## Working with the owner

- **Act in the spirit of this plugin:** its conventions, its ADRs and the owner's preferences recorded in them. The more autonomy you have, the more this matters: you decide as the owner would.
- **How much you decide without asking** is set by the autonomy level at the end of these conventions (`guided`, `trusted` or `autonomous`, ADR 0044). The owner changes it with `/factory:autonomy`; never raise it yourself.
- **Always have a recommended option.** Every choice gets one, with the reason, instead of options listed neutrally. It is what you act on when the level lets you decide, and what the owner can default to. If none can be recommended from the conventions, the ADRs or the owner's recorded preferences, the choice is the owner's at every level.
- **New tasks start with triage** (the `factory-triage` skill, or `/factory:start`, ADR 0051): classify the task, propose a route through the stages with a level per stage, and wait for the owner. Skip it when the owner says "no triage".
- **Push back, with reasons.** When a request has a trade-off, conflicts with another convention, or has a better alternative, say so before building: explain why, and give a concrete recommendation. Don't comply silently, and don't refuse. The owner decides.
- **Always the owner's, at every level:** changing these conventions or an accepted ADR; accepting or rejecting a change of architecture (ADR 0045); exceptions to the license policy; anything destructive or irreversible (force-pushing, deleting unmerged work, deleting data); production and secrets; paid services; making anything public.
- **No untracked debt.** A problem you find is fixed now or becomes a tracked task (`TODO.md` or an issue), never an untracked `TODO` comment or a silent workaround. When a task needs a workaround *because of the architecture*, add a line to the workaround log in `docs/architecture/README.md` (date, scope, what and why), so the `architecture` checkup sees the pattern (ADR 0045).

## Code style

- **Optimize for readability.** It wins when other rules conflict.
- Never nest: prefer early returns, guard clauses, and flat code over nested conditionals/loops.
- **Declarative by default.** Chains of `filter`/`map`/`flatMap` and the like are preferred over loops with changing state: they say *what* happens instead of making the reader simulate *how*. Keep each step simple: one step per line, and a named function instead of a long inline lambda. Use imperative code where the logic really is stateful (a small parser, early exits that depend on accumulated state, a measured hot loop). Not dogma: readability decides.
- Always use curlies when writing if-while-for statements.
- **One condition per `if`**: each `if` tests one named concept. Split guards into separate early returns; combine conditions only inside a well-named variable or function (`const isNoLongerValid = isExpired || isRevoked;`). No nested ternaries.
- Use negative space programming: guard against invariants with a function called `assert`.
- **Secure by default:** every entry point (endpoint, server action, webhook, command, job) requires authentication and authorisation, unless the spec marks it public and says why. Shipping without them is the owner's explicit decision, never a quiet gap (ADR 0057).
- **Fail fast:** stop at the first point that can see a problem, loudly: check configuration at startup, use defaults only for "not provided" (never for "invalid"), and let the compiler check that every case is handled. Fall back only where failing does more harm, and then to the safe side, loudly.
- **Put a limit on everything:** every loop that isn't over a bounded collection counts against a named maximum; every input, collection, queue, cache, retry, wait and recursion has an explicit upper bound, and values with a meaningful minimum (sizes, counts, timeouts, required text and lists) have an explicit lower bound. Crossing a bound fails loudly; it never truncates silently.

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

## Licenses

- Only permissive open-source licenses, for dependencies (including development tools), tools and plugins: MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, MIT-0, Unlicense, CC0-1.0, Zlib, BlueOak-1.0.0. Never copyleft (GPL, AGPL, LGPL, MPL, EPL), source-available (BSL, SSPL, Elastic, Commons Clause), non-commercial or proprietary licenses. For an SPDX expression, `A OR B` needs one allowed side and `A AND B` needs both. Check the license before proposing a dependency.

## Helpers

- Prefer small, own, tested and documented helpers (e.g. `isNotNil`) over utility libraries like lodash. Add a helper when it's needed, not in advance.
- Hard problems (schema parsing, dates, crypto) use a proven library.

## API design

- Positional parameters only for what a function is *about*; everything that controls *how* goes in an options object as the last parameter. No positional booleans.
- Results of operations that report an outcome as data (parse, validate, partial failure) are objects or discriminated unions, so they can grow; predicates, conversions, and operations that return one value or throw return plain values.
- Options that change meaning or are risky are required; tuning knobs may have a default, but only a visible, documented one. Dangerous or costly behaviour is opt-in.

## Cancellation

- All work that waits (network, files, database, subprocesses, timers, long loops) is cancellable. Such functions take a **required** cancellation handle (`AbortSignal` in TypeScript, `context.Context` in Go), pass it to everything they call, and check it in long loops.
- Timeouts use the same mechanism. Cancellation is not a failure: don't log it as an error or retry it.

## Documentation

- Every export has a full doc comment (TSDoc in TypeScript), including at least one example for functions and classes. Examples run as tests. Internal code only gets a comment when the *why* isn't obvious.
- Documentation for people follows the `writing-documentation` skill: what and why first, short and plain, and just as precise.

## Tests

- Add tests for each feature you make, even when not explicitly asked, and make them extensive: unit tests for every edge case (found systematically: equivalence classes, boundaries, a fixed checklist), integration and component tests (Testing Library) for the largest part of the surface, and Playwright end-to-end tests for every key flow's happy path and critical failure paths.
- Test behaviour, never implementation. Mock only the outer edges (network, clock, randomness). A flaky test is a bug.
- Test output is clean: unexpected console output, warnings, unhandled errors or leaks are bugs (ADR 0059, `code-testing`).

## Styling

- Use the project's existing styling approach. In a project without one, use CSS Modules with design tokens as CSS custom properties; don't add a CSS framework or CSS-in-JS runtime without the owner's decision.

## Topic conventions

For React/UI work, load the `code-react` skill and the `code-styling` skill, and the `code-accessibility` skill to write a11y tests with it. For writing tests, load the `code-testing` skill. For async or I/O code, load the `code-cancellation` skill for the language-specific rules. For doc comments, load the `code-documentation` skill. For signatures, options and return types, load the `code-api-design` skill. For loops, retries, queues, caches, concurrency, input limits, assertions or error handling, load the `code-safety` skill. For database schemas, migrations and queries, load the `code-sql` skill. For examples of the readability and optionality rules, and for naming, load the `code-readability` skill. For schemas and parsing, load the `code-parsing` skill. For documentation meant for people, load the `writing-documentation` skill.

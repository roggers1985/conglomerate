# Owner's core conventions

These conventions apply to all work in this session. They come from the factory plugin. The rest of the conventions are in the `code-*` and `writing-documentation` skills: load the one that fits the work (`code-readability`, `code-safety`, `code-parsing`, `code-api-design`, `code-cancellation`, `code-documentation`, `code-testing`, `code-react`, `code-styling`, `code-accessibility`, `code-sql`).

## Working with the owner

- **Act in the spirit of this plugin:** its conventions, its ADRs and the owner's preferences recorded in them. The more autonomy you have, the more this matters: you decide as the owner would.
- **How much you decide without asking** is set by the autonomy level in the autonomy section of the session context (`guided`, `trusted` or `autonomous`, ADR 0044). The owner changes it with `/factory:autonomy`; never raise it yourself.
- **Always have a recommended option.** Every choice gets one, with the reason, instead of options listed neutrally. It is what you act on when the level lets you decide, and what the owner can default to. If none can be recommended from the conventions, the ADRs or the owner's recorded preferences, the choice is the owner's at every level.
- **Medium and large tasks start with triage** (the `factory-triage` skill, or `/factory:start`, ADR 0051): classify the task, propose a route through the stages with a level per stage, and wait for the owner. A small, low-risk, reversible change with no new entry point skips triage and the pipeline: do it, run the checks, report (ADR 0067). Skip it also when the owner says "no triage".
- **Push back, with reasons.** When a request has a trade-off, conflicts with another convention, or has a better alternative, say so before building: explain why, and give a concrete recommendation. Don't comply silently, and don't refuse. The owner decides.
- **Always the owner's, at every level:** changing these conventions or an accepted ADR; accepting or rejecting a change of architecture (ADR 0045); exceptions to the license policy; anything destructive or irreversible (force-pushing, deleting unmerged work, deleting data); production and secrets; paid services; making anything public.
- **No untracked debt.** A problem you find is fixed now or becomes a tracked task (`TODO.md` or an issue), never an untracked `TODO` comment or a silent workaround. A workaround needed *because of the architecture* also goes in the workaround log in `docs/architecture/README.md` (ADR 0045).

## Code

- **Optimize for readability.** It wins when other rules conflict. Never nest: early returns and guard clauses. Always use curlies. One named condition per `if`. Declarative (`filter`/`map`) over loops with changing state, unless the logic really is stateful.
- **Secure by default:** every entry point (endpoint, server action, webhook, command, job) requires authentication and authorisation, unless the spec marks it public and says why (ADR 0057).
- **Fail fast:** stop at the first point that sees a problem, loudly. Defaults are for "not provided", never for "invalid". Use an `assert` function for invariants.
- **Put a limit on everything:** every loop that isn't over a bounded collection, input, queue, cache, retry, wait and recursion has an explicit bound. Crossing a bound fails loudly; it never truncates silently.
- **Parse, don't validate.** Everything from outside our code (HTTP, env vars, files, database rows, SDK and LLM output) goes through a schema (Zod) before use, once, at the boundary. Strict for our own shapes, tolerant of extra fields for shapes we don't control. A parse failure is expected; an `assert` failure is a bug.
- **Optionality at the boundaries:** normalise input into complete types at the edge. An empty collection, never `null`, means "nothing". `undefined` means "not provided"; `null` means "deliberately no value". Use `?.` and `??` only on values that can be nullish.
- **Cancellation:** all work that waits (network, files, database, subprocesses, timers) takes a **required** `AbortSignal` (`context.Context` in Go) and passes it on. Cancellation is not a failure.
- Prefer small, own, tested helpers over utility libraries. Hard problems (parsing, dates, crypto) use a proven library.
- **Licenses:** dependencies, tools and plugins are permissive open source only (MIT, ISC, BSD, Apache-2.0 and the like). Never copyleft, source-available, non-commercial or proprietary. Check before proposing a dependency (ADR 0035).

## Tests and documentation

- Add tests for each feature, and test where the risk is: real state and money (cart, checkout, forms), edge cases found systematically, accessibility per page, and the key flows end to end. No tests for stubs, and no per-prop matrices (ADR 0068). Test behaviour, never implementation; mock only the outer edges. A flaky test is a bug, and test output is clean (ADR 0059).
- A migration meant to keep behaviour first gets a behaviour test that passes on the old code and then on the new code unchanged (`code-testing`).
- Every export has a doc comment with a tested example for functions and classes (ADR 0016). Documentation for people follows `writing-documentation`.

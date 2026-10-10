---
name: code-documentation
description: The owner's code documentation conventions. Covers TSDoc in TypeScript and doc comments in Go, Python and Rust, always with examples that run as tests. Use when writing or changing exported functions, classes, types or constants, or when writing or reviewing documentation comments.
---

# Documentation conventions

Exported code is documented well enough to use without reading its body, and every example runs as a test, so the documentation can't silently go wrong.

## What to document

- **Every export** gets a full doc comment.
- **Internal code** only gets a comment when the *why* isn't obvious: a constraint, an ADR, or a rejected alternative. It never repeats what the code does (see "Comments" in `code-readability`). An export's doc comment is documentation, not such a comment: its summary says what the export does, and the same three kinds of why go in `@remarks`.
- **Don't repeat names or types.** Write what the types can't express: units, ranges, meaning, invariants (`assert`), side effects, cancellation, and when it throws.

## TypeScript: TSDoc

| Tag | When |
|---|---|
| Summary (first paragraph) | always: what it does, in one sentence |
| `@param name - …` | every parameter; for an options object, document its fields as `options.signal`, etc. |
| `@returns` | when it returns something |
| `@throws` | every way it can throw, including `assert` invariants and `AbortError` |
| `@example` | at least one for functions and classes; more for edge cases and errors |
| `@remarks` | the *why*: design choices, trade-offs, links to ADRs |
| `@see`, `{@link Name}` | related code |
| `@deprecated` | with what to use instead |

Types and constants need at least a summary. Functions and classes also need an example.

~~~ts
/**
 * Fetches a job by its id.
 *
 * @remarks
 * Adds a 10-second timeout (`FETCH_TIMEOUT_MS`) to the caller's signal: one job is a small record (ADR 0012).
 *
 * @param id - The job's public id, e.g. `"j_123"`.
 * @param options.signal - Cancels the request.
 * @returns The job, with dates parsed.
 * @throws NotFoundError when no job has this id.
 * @throws DOMException named `AbortError` or `TimeoutError` when cancelled.
 *
 * @example
 * ```ts
 * const job = await fetchJob("j_123", { signal: AbortSignal.timeout(5_000) });
 *
 * expect(job.id).toBe("j_123");
 * ```
 */
~~~

### Examples are tests

The factory's doctest runs every `@example` and fails when documentation is missing:

```sh
bun "${CLAUDE_PLUGIN_ROOT}/dist/doctest.js" src scripts
```

- **Scope:** each example runs in its own async test, with the module's exported values and `expect` in scope.
- **Show outcomes with `expect(…)`.** It documents and checks at the same time.
- **Self-contained and deterministic:** no network and no real clock; pass dates in, and use a temporary directory when files are needed.
- **Use ```` ```ts no-run ```` only when an example truly can't run.** First try to restructure it so it can.
- **Two limits of doc comments:**
  - an example can't contain the comment-closing sequence, so write `*\/` inside strings;
  - it can't contain triple backticks, so write `` "`".repeat(3) ``.
- **What's in scope:** type names need no import (Bun strips types). Values from other modules are not in scope.
- **Wiring it into a project:** add the doctest to the project's `check` script. The script has no dependencies. If the project should not depend on the plugin's install location, propose copying it into the project's own `scripts/`.

## Go

- Every exported name has a doc comment that starts with the name: `// FetchJob fetches …`.
- Examples are `Example<Name>` functions in `_test.go` files, with an `// Output:` comment. `go test` runs them and compares the output.
- Document errors, cancellation (`ctx`) and concurrency safety in the comment.

## Python

- Every public module, class and function has a docstring, in the project's style (Google style if none is set): `Args`, `Returns`, `Raises`.
- Examples are `>>>` blocks, run with `python -m doctest` or `pytest --doctest-modules` as part of the checks.

## Rust

- Every public item has a `///` doc comment with the sections `# Examples`, `# Errors` and `# Panics` where they apply.
- `cargo test` runs the code blocks in doc comments. Keep them compiling. Use `no_run` only for examples that can't run, and `ignore` never.

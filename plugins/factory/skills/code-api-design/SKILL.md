---
name: code-api-design
description: The owner's API design conventions for function signatures, options and return values. Covers positional parameters vs options objects, designing for extension, and explicit over hidden defaults, with sections for TypeScript, Go, Python and Rust. Use when designing or changing a function, method or constructor signature, an options type, or a return type.
---

# API design conventions

A signature should read clearly at the call site, and be able to grow without breaking its callers.

## 1. Positional parameters for the "what", an options object for the "how"

- **Positional:** only the one or two things the function is *about*: `fetchJob(id, …)`, `copy(from, to, …)`.
- **Everything that controls *how*** goes in one options object, always the last parameter: `fetchJob(id, { signal, timeoutMs })`.
- **Never a positional boolean.** `render(page, true)` says nothing at the call site; `render(page, { draft: true })` does.
- **Never an optional positional parameter.** Optional things go in the options object.
- The cancellation handle is an option like any other (see `code-cancellation`).

## 2. Design for extension

- **Inputs:** the options object is the extension point. Adding an option breaks no existing call.
- **The result of an operation that reports an expected outcome as data** (parse, validate, anything that can partly fail, or whose callers branch on the outcome) is an **object or a discriminated union**, never a bare value. Such results tend to grow extra information: warnings, a cursor, timings, partial errors.

  ```ts
  type ParsedConfig = { kind: "valid"; config: Config; warnings: string[] } | { kind: "invalid"; errors: string[] };
  ```

  A new outcome becomes a new `kind`, and a new detail becomes a new field.
- **Predicates and conversions** return a plain value: `isDue(): boolean`, `formatDate(): string`. There the value *is* the concept, and a wrapper is noise.
- **An operation that either returns its one value or throws** (reading a file, fetching one record) may return the value itself: `readText(): Promise<string>`. Failure is an exception, not an outcome the caller branches on.
- **Rule of thumb:** could a caller ever want to know *more* about this result? Then return an object.

## 3. Explicit over hidden defaults

Options come in two kinds:

| Kind | Rule | Examples |
|---|---|---|
| **Changes the meaning, or is risky** | **Required.** The caller must decide | `signal`, `dryRun`, `overwrite`, target environment, anything destructive |
| **Tuning knob** | May be optional, but **never a hidden default** | `retries`, `timeoutMs`, `pageSize`, `indent` |

- **No hidden defaults:**
  - a default is applied **in one visible place**, the parameter's destructuring (`{ retries = 3 }`);
  - it is **documented** with `@defaultValue`;
  - it is never applied deeper in the code.
- **Dangerous or costly behaviour is opt-in:** off unless the caller switches it on.
- Keep `exactOptionalPropertyTypes` on (TypeScript), so `undefined` can't be passed to mean "use the default".

## TypeScript

~~~ts
type FetchJobsOptions = {
    /** Cancels the request (required: ADR 0012). */
    readonly signal: AbortSignal;
    /** Include expired jobs. Opt-in, because expired jobs are rarely wanted. @defaultValue false */
    readonly includeExpired?: boolean;
    /** Page size. @defaultValue 20 */
    readonly pageSize?: number;
};

type FetchJobsResult = {
    readonly jobs: readonly Job[];
    /** Pass this as `after` to get the next page; `null` on the last page. */
    readonly nextCursor: string | null;
};

export async function fetchJobs(
    query: JobQuery,
    { signal, includeExpired = false, pageSize = 20 }: FetchJobsOptions,
): Promise<FetchJobsResult> {
    // …
}
~~~

- Name options types `<Function>Options` and result types `<Function>Result` (or a `Parsed…`/`…Outcome` union), and export them with the function.
- Make fields `readonly`.
- Destructure the options in the signature, so the defaults are visible there.

## Go

- **Positional:** the main parameters, after `ctx`.
- **Options:** configuration goes in an `Options` struct (`FetchJobs(ctx, query, FetchJobsOptions{PageSize: 50})`), or in functional options for public libraries.
- **Zero values:** a zero value must mean something sensible, and the default is documented on the field.
- **Results:** a result struct plus `error`, so fields can be added later.

## Python

- **Keyword-only options:** everything after the main parameters is keyword-only: `def fetch_jobs(query, *, include_expired=False, page_size=20)`.
- **No mutable defaults.**
- **Results:** a dataclass (or `NamedTuple`) rather than a bare tuple.

## Rust

- **Options:** configuration goes in an options struct that implements `Default` (`fetch_jobs(&query, FetchJobsOptions { page_size: 50, ..Default::default() })`), or in a builder for types with many settings.
- **Results:** a struct (or an enum for outcomes) inside `Result<_, _>`, never a bare tuple.
- **Future variants:** mark public structs and enums `#[non_exhaustive]` when they are expected to grow.

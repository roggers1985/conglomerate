---
name: code-cancellation
description: The owner's cancellation conventions. Covers AbortSignal in TypeScript/JavaScript (including React effects), context.Context in Go, and the equivalents in Python and Rust. Use when writing or reviewing async code, I/O (network, files, database, subprocesses), long-running loops, timeouts, retries, background jobs, or React effects that do async work.
---

# Cancellation conventions

All work that waits can be cancelled, and cancellation flows from the top of the call chain to the bottom. A timeout or deadline is just one kind of cancellation.

## Rules for every language

1. **Required parameter.** A function that does I/O or long-running work takes a cancellation handle as a required parameter. There is no hidden default and no global.
2. **Pass it on.** Pass it to every callee that accepts one: HTTP clients, database drivers, file APIs, subprocesses, sleeps and timers.
3. **Check it.** Check it at the start, between the steps of a multi-step job, and in every long loop.
4. **Create it at the edges only.** Create cancellation handles at the edges: a request handler, CLI `main`, an event handler, a component effect or a job runner. Everything further down only derives from the handle it received, by adding a timeout or combining handles.
5. **Timeouts use the same mechanism.** Never race the work against a timer and leave the work running.
6. **Clean up and stop.** On cancellation, close connections, stop child processes and remove temporary files. Don't start new work.
7. **Cancellation is not a failure.** Don't log it as an error, don't retry it, don't show error UI. Pass it up.
8. **Retries respect it,** including while waiting between attempts.
9. **Test it.** Every cancellable function gets a test that cancels it and checks that it stops (and cleans up).

## TypeScript / JavaScript

- **Signature:** the last parameter is an options object with a required `signal`, e.g. `fetchJob(id, { signal })`.
- **Pass it to:**
  - `fetch(url, { signal })`
  - `node:fs/promises` (`readFile`, `writeFile`, … with `{ signal }`)
  - `setTimeout` from `node:timers/promises`
  - `spawn(…, { signal })`
  - database drivers and SDKs that accept one
  - `addEventListener(type, listener, { signal })`: aborting then also removes the listener
- **Derive:** `AbortSignal.timeout(ms)`, and `AbortSignal.any([signal, AbortSignal.timeout(ms)])` to add a timeout to a signal you received.
- **Check:** `signal.throwIfAborted()` at the start, between steps and in loops.
- **Your own waiting code:** listen with `signal.addEventListener("abort", onAbort, { once: true })`, and remove the listener when the work finishes.
- **Tell cancellation apart from failure:** an aborted signal produces an `AbortError`, and `AbortSignal.timeout` produces a `TimeoutError`. Check with a small helper and rethrow.
- **At the top:** in a CLI `main`, abort a controller on `SIGINT`/`SIGTERM`. Where nothing can cancel, pass `AbortSignal.timeout(…)`, so the work is at least bounded.

```ts
export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");
}

const FETCH_TIMEOUT_MS = 10_000; // one job is a small record; the API answers well within a second
const JOB_BYTES_MAX = 64 * 1024;

export async function fetchJob(id: string, { signal }: { signal: AbortSignal }): Promise<Job> {
    const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const response = await fetch(`/api/jobs/${id}`, { signal: AbortSignal.any([signal, timeoutSignal]) });
    // Reads the body as a stream and fails past the limit, instead of `response.json()` (see `code-safety`).
    const body = await readBodyText(response, { maxBytes: JOB_BYTES_MAX, signal });

    return parseJob(JSON.parse(body));
}

export async function syncJobs(ids: readonly string[], { signal }: { signal: AbortSignal }): Promise<void> {
    for (const id of ids) {
        signal.throwIfAborted();
        await syncJob(await fetchJob(id, { signal }), { signal });
    }
}
```

```ts
it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(syncJobs(["1"], { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
});
```

### React

An effect that starts async work or adds listeners creates its own `AbortController` and aborts it in the cleanup. This also covers stale responses when the dependencies change. Prefer server-side data fetching where the framework allows it (see `code-react`); this pattern is for work that has to run on the client.

```tsx
useEffect(() => {
    const controller = new AbortController();

    window.addEventListener("resize", onResize, { signal: controller.signal });
    loadSuggestions(query, { signal: controller.signal }).then(setSuggestions, (error: unknown) => {
        if (isAbortError(error)) {
            return;
        }
        setError(error);
    });

    return () => controller.abort();
}, [query]);
```

## Go

- **`ctx context.Context` is always the first parameter.** Name it `ctx` and never store it in a struct. Never pass `nil`: use `context.TODO()` while the wiring is unfinished.
- **Pass it to:** `http.NewRequestWithContext`, `db.QueryContext`/`ExecContext`, `exec.CommandContext`, and every client that has a context variant.
- **Derive:** `context.WithTimeout`, `WithDeadline` and `WithCancel`, always followed by `defer cancel()`. Use `WithCancelCause`/`WithTimeoutCause` when the reason matters.
- **Check:** use `select { case <-ctx.Done(): return ctx.Err() … }` in loops and around channel operations, and `ctx.Err()` between steps.
- **Goroutines:** every goroutine gets a context and returns when it's done. Use `errgroup.WithContext` so siblings are cancelled together.
- **Tell cancellation apart from failure:** `errors.Is(err, context.Canceled)` and `errors.Is(err, context.DeadlineExceeded)`.
- **At the top:** in `main`, use `signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)`. In HTTP handlers, use `r.Context()`.

## Python (asyncio)

- Cancellation is built into tasks. Never swallow `asyncio.CancelledError`: if you catch it to clean up, re-raise it. Prefer `try`/`finally` and `async with`.
- Timeouts: `async with asyncio.timeout(seconds):`.
- Use `asyncio.TaskGroup`, so a failing or cancelled task cancels its siblings.
- For blocking work in threads, pass a `threading.Event` explicitly and check it in loops.

## Rust (tokio)

- Dropping a future cancels it. Keep code cancel-safe: never leave state half-updated across an `.await`, and know which APIs are cancel-safe inside `tokio::select!`.
- For explicit cancellation, pass a `tokio_util::sync::CancellationToken` as a parameter. Use `child_token()` to derive one, and `select!` on `token.cancelled()`.
- Timeouts: `tokio::time::timeout`.
- Keep spawned tasks in a `JoinSet` (or keep their handles) and cancel them on shutdown.

---
name: code-safety
description: "The owner's safety conventions, inspired by NASA/JPL's Power of 10 and TigerBeetle's TigerStyle. It starts with bounds, so that every loop, retry, recursion, input, collection, queue, cache and wait has an explicit upper bound. Use when writing loops, retries, pagination, recursion, queues, caches, concurrency or input handling, or when reviewing code for robustness."
---

# Safety conventions

## Put a limit on everything

Every quantity that can grow has an explicit upper bound, and hitting it is an error, not a silent truncation. This comes from NASA/JPL's "Power of 10" (rule 2: "all loops must have a fixed upper bound") and TigerStyle ("put a limit on everything").

### Loops

- **A loop over a collection** (`for … of`, `map`, `filter`) is bounded by that collection, so the collection itself must be bounded where it enters the program (see "Inputs").
- **Every other loop** (`while`, polling, retries, walking pages or linked structures) counts its iterations against a named maximum, and fails loudly when it's reached:

  ```ts
  const PAGES_MAX = 1_000;

  for (let page = 0; page < PAGES_MAX; page++) {
      const result = await fetchPage(cursor, { signal });
      collect(result.items);

      if (result.nextCursor === null) {
          return;
      }

      cursor = result.nextCursor;
  }

  throw new Error(`Stopped after ${PAGES_MAX} pages: the source may be looping`);
  ```

- No `while (true)` without such a counter.

### Recursion

Avoid recursion; prefer a loop with an explicit stack and a maximum. Where recursion is the clearest solution (e.g. walking a tree of known shape), pass a depth and assert it stays under a named maximum.

### Inputs

Everything from outside has a maximum size, set in its schema (see `code-parsing`):

```ts
const CommentSchema = z.strictObject({
    body: z.string().min(1).max(10_000),
    tags: z.array(z.string().max(50)).max(20),
    rating: z.number().int().min(1).max(5),
});
```

- Request bodies, uploads and files are limited in size *before* they are read completely.
- Query parameters for page sizes and limits have a maximum, even when the caller may choose.

### Retries, waits and concurrency

- **Retries:** a maximum number of attempts *and* a maximum total time, with backoff that has a ceiling.
- **Waits:** every wait has a timeout, through the cancellation signal (`AbortSignal.timeout`, see `code-cancellation`).
- **Concurrency:** a maximum number of operations in flight (e.g. a small pool), never `Promise.all` over an unbounded list of I/O calls.

### Memory

Queues, caches, buffers and in-memory collections have a maximum size and a documented policy for when it's reached: evict (e.g. least recently used), reject new work (backpressure), or fail.

### How bounds are written

- **Named constants,** documented with the reason for the number: `const PAGES_MAX = 1_000; // a full catalogue is ~200 pages`. No bare numbers in conditions.
- **Hitting a bound fails loudly:** an error with the bound in its message, or an `assert` for bounds that can only be hit by a bug. Silent truncation is only allowed where the specification says so, and it is then documented.
- **Every bound is tested:** at the bound, and one over it (see the boundary values in `code-testing`).

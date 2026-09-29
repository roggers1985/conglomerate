# 32. Upper bounds on everything

Date: 2026-09-29

## Status

Accepted

## Context

The owner always puts upper bounds on numbers and loops. This is a core rule of NASA/JPL's "Power of 10: Rules for Developing Safety-Critical Code" (Holzmann, 2006; rule 2: "all loops must have a fixed upper bound"). It is also in TigerBeetle's TigerStyle ("put a limit on everything"), where the owner's "negative space programming" comes from as well. An unbounded loop, retry or input turns a small bug or a hostile input into a hang, an out-of-memory error or a runaway bill.

## Decision

- **In `core.md`, always on:** every quantity that can grow has an explicit upper bound, and hitting it fails loudly.
- **The new `code-safety` skill has the details:**
  - loops over collections are bounded by the collection, which must be bounded where it enters;
  - every other loop counts against a named maximum, with no `while (true)` without a counter;
  - recursion is avoided or depth-limited;
  - inputs get maximums in their schemas, and file and request sizes are limited before reading;
  - retries have maximum attempts and total time;
  - every wait has a timeout;
  - concurrency is limited to a maximum number of operations in flight;
  - queues, caches and buffers have a maximum size and a policy for when it's reached.
- **How bounds are written:** named constants with the reason for the number; errors that name the bound; tests at the bound and one over it.
- **Other practices from NASA's rules and TigerStyle** are listed in `TODO.md` for discussion. `code-safety` is where the accepted ones will go.

## Consequences

- Code states its limits explicitly, and a limit that turns out too low shows up as a clear error, not as a hang.
- This repository's own code doesn't follow the rule everywhere yet (e.g. files are read without a size limit, and parsed JSON lists have no maximum). That is tracked in `TODO.md`.

# 38. Safety practices from Power of 10 and TigerStyle

Date: 2026-09-30

## Status

Accepted

Extends [ADR-0032](0032-upper-bounds-on-everything.md) (the `code-safety` skill), [ADR-0017](0017-api-design-convention.md) (explicit options, now also for libraries) and [ADR-0019](0019-readability-and-optionality.md) (scope and naming).

## Context

ADR-0032 took bounds from NASA/JPL's "Power of 10" (Holzmann, 2006) and TigerBeetle's TigerStyle, and listed their other practices in `TODO.md` for discussion. The owner went through them one by one. Their guiding principle: **lead by logic, not by numbers**. A rule that prescribes a count invites dogmatism, so a practice is adopted for the bugs it prevents, in the form that prevents them.

## Decision

- **Assertions, without a quota.** Power of 10 and TigerStyle ask for two or more assertions per function on average. We don't set a number. We assert what the types can't express: numeric ranges, whole numbers, non-blank strings, relations between values, and state a function relies on. We skip what the type checker already proves. Where data is written in one place and read in another, the same property is checked on both sides (*pair assertions*).
- **Functions of at most 70 lines** (TigerStyle; NASA says 60), blank lines not counted. Biome's `noExcessiveLinesPerFunction` enforces it, and test files are exempt. 70 rather than 60 leaves room for React components with JSX in other projects. The code in this repository fits within 60 either way.
- **Every error is handled.** No empty `catch`, no `catch` that only logs, and no ignored promises. Biome's `noFloatingPromises` and `noMisusedPromises` enforce this. Both are still experimental (nursery) rules; the `outdated-packages` and `new-features` checkups catch it when they are renamed or promoted.
- **Explicit options for libraries.** Options that bound or change a library's behaviour (timeouts, size limits, retries, concurrency, modes) are passed explicitly, because library defaults are often unlimited. This extends ADR-0017's "explicit over hidden defaults" to the libraries we call.
- **Smallest scope:** variables are declared close to their first use, with few in play at once (`code-readability`).
- **Names with units and qualifiers last** (`timeoutMs`, `latencyMsMax`, `PACKAGES_MAX`), and no abbreviations except familiar ones like `id`, `url` and `json` (`code-readability`).
- **Index, count and size are different things,** and rounding is always explicit (`code-safety`).
- **No untracked debt:** a problem that is found is fixed now or becomes a tracked task, never an untracked `TODO` comment (`core.md`, since it applies to all work).
- **Belongs to the Planning stage, not a coding rule:** back-of-the-envelope sketches of network, disk, memory and CPU costs, and batching as a design question within them. They are part of the Planning stage's to-do item.
- **Already in place:** static analysis at its strictest setting, with warnings as errors (ADR-0004, ADR-0005).

## Consequences

- `code-safety` now covers assertions, function length, errors, library options, and index, count and size, alongside bounds. `code-readability` covers scope and naming.
- Three more lint rules run on every push. None of them reports anything in the current code.
- A reviewer can't point to a missing "second assertion", only to a property that isn't checked where it should be. That takes more judgement, which is the intent.

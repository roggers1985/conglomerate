# 22. Declarative by default

Date: 2026-09-29

## Status

Accepted

Amends [ADR-0019](0019-readability-and-optionality.md): a hard-to-read chain no longer "becomes a plain loop" by default.

## Context

ADR-0019 made readability the top rule, and suggested that a long declarative chain could become a plain loop. The owner finds declarative code generally *more* readable, even with chaining. Imperative code makes the reader follow the state changes in their head. The owner doesn't want this to be dogmatic.

## Decision

- **Declarative is the default.** Chains of `filter`/`map`/`flatMap` and the like are preferred over loops with changing state, even when they are long.
- **A chain stays readable because its steps are simple:**
  - one step per line;
  - named functions for non-trivial steps;
  - named intermediate results when they are concepts of their own;
  - purpose-built operations (`Object.groupBy`, `Map`, `flatMap`) instead of a `reduce` with a complex accumulator;
  - no side effects inside `map` or `filter`.
- **Imperative code is the right choice where the logic really is stateful:**
  - small parsers;
  - early exits that depend on accumulated state;
  - sequential async work with cancellation checks;
  - measured hot loops.
- **Readability still decides** when the two disagree. The rules are in `core.md`, with examples in the `code-readability` skill.

## Consequences

- When a chain is hard to read, the fix is to name its steps, not to rewrite it as a loop.
- This repository's small doc-comment parser in `doctest.ts` stays imperative: it tracks "inside a code block" across lines, which is one of the stateful cases.

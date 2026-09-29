# 16. Documentation with tested examples

Date: 2026-09-29

## Status

Accepted

## Context

The owner wants extensive documentation comments, with examples, as a convention. Examples show how to use code faster than prose, and agents copy them, which is also the risk: an example that no longer matches the code misleads. TypeScript doesn't check code inside comments. Go (`Example` functions), Rust (doc tests) and Python (`doctest`) can run examples as tests; TypeScript has no built-in equivalent.

## Decision

- **Scope:**
  - every export gets a full doc comment;
  - functions and classes also get at least one example;
  - internal code only gets a comment when the *why* isn't obvious.

  Documenting literally everything was considered and rejected: comments on trivial internals add noise and drift.
- **TypeScript uses TSDoc:** summary, `@param`, `@returns`, `@throws`, `@example`, `@remarks` (the why, with ADR links), `@see`/`{@link}`, `@deprecated`.
- **Examples are tests.** In TypeScript this is done by `plugins/factory/scripts/doctest.ts`, a dependency-free Bun script. It:
  - fails when an export has no summary, or a function or class has no example;
  - runs every ```` ```ts ```` example as a `bun:test` test, with the module's exports and `expect` in scope;
  - skips examples fenced as ```` ```ts no-run ````, which are for examples that truly can't run.

  Existing tools (the-real-doctest, tsdoc-testify, doctest-ts, testdocs) target Jest/Vitest or Markdown and add dependencies.
- **Other languages use their native mechanisms:** Go `Example` functions, `cargo test` doc tests, Python `doctest`.
- **Where it lives:** the principle is in `core.md`; the details per language are in the `code-documentation` skill.
- **This repository follows it:** `bun run doctest` is part of `bun run check`, so of the pre-push hook. Exports that nothing outside their module used were made internal rather than documented, and the unused `taskAgentId` was removed.

## Consequences

- Examples cannot go stale unnoticed: a broken example blocks the push like a failing test.
- The doctest finds exports with a regex, not the TypeScript compiler. That keeps it small and independent of the compiler (TypeScript 7 changed the compiler's API), but it only recognises `export function|const|let|class|type|interface|enum` at the start of a line.
- Examples can't be type-checked, because Bun strips types without checking them. Only their runtime behaviour is tested.
- Documentation takes real effort per export. Keeping the exported surface small keeps that effort in check.

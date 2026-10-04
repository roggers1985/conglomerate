# 12. Cancellation convention

Date: 2026-09-29

## Status

Accepted. Amended by [ADR-0059](0059-clean-test-output.md): `readTextSync`, used by the test setup, takes no signal.

## Context

The owner always builds in cancellation: `context.Context` in Go, `AbortSignal` in TypeScript, and so on. Without it, abandoned requests keep running, timeouts leave work behind, and shutdowns hang. The principle is the same in every language, but how it is written differs per language.

## Decision

- The principle goes in the always-on core conventions (`conventions/core.md`, ADR-0008): work that waits is cancellable through a required handle that is passed down and checked, timeouts use the same mechanism, and cancellation is not treated as a failure.
- The details per language go in the `cancellation-conventions` skill, which loads when Claude writes async or I/O code. It starts with TypeScript (including React effects), Go, Python and Rust, and more languages are added when needed.
- In TypeScript the signal is a **required** field in the last parameter, an options object: `fn(input, { signal })`. This mirrors Go's required `ctx`, fits the owner's preference for required parameters over optional ones, and makes a forgotten signal a type error.
- Signals are created only at the edges (request handlers, CLI `main`, event handlers, effects, job runners). Code further down only derives from them.

## Consequences

- Calls get a little more verbose, since every call site must pass a signal. That is accepted.
- Libraries that expect `signal?: AbortSignal` still work: a required signal can always be passed where an optional one is accepted.
- The `code-quality` checkup should check this convention once it exists.
- This repository's own scripts don't follow it yet. They are short-lived CLIs, and several Bun APIs they use (`Bun.file`, `readdir`) take no signal. This is tracked in `TODO.md`.

# 17. API design convention

Date: 2026-09-29

## Status

Accepted. Extended by [ADR-0038](0038-safety-practices-from-power-of-10-and-tigerstyle.md): explicit options for libraries too.

## Context

The owner wants a consistent way of designing function signatures:
- positional parameters for the main inputs;
- options as an object;
- designing for future extension;
- explicit options rather than hidden defaults.

These wishes pull against each other in one place. Making every option required is explicit, but then adding an option later breaks every caller, which undoes the extensibility an options object is for.

## Decision

A `code-api-design` skill, with a short summary in `core.md`. It covers all languages, with a section each for TypeScript, Go, Python and Rust.

1. **Positional vs options:** positional parameters only for the one or two things a function is *about*; everything that controls *how* goes in an options object as the last parameter. No positional booleans, and no optional positional parameters. This follows established practice (`fetch(url, init)`, `readFile(path, options)`).
2. **Extension:**
   - the options object is the extension point for inputs;
   - results of operations (parse, validate, fetch, I/O) are objects or discriminated unions;
   - predicates and conversions return plain values. Wrapping those would be noise.

   Rule of thumb: could a caller ever want to know more about this result?
3. **Explicit over hidden defaults:** options come in two kinds, which resolves the tension above.
   - **Options that change the meaning or are risky** (`signal`, `dryRun`, `overwrite`, environment) are required.
   - **Tuning knobs** (`retries`, `timeoutMs`) may be optional, but only with a visible default, set in the signature's destructuring and documented with `@defaultValue`.
   - Dangerous or costly behaviour is opt-in.

## Consequences

- New options can be added without breaking callers, while every decision that matters stays visible at the call site.
- Existing code in this repository doesn't follow this everywhere yet: several functions take three positional parameters (e.g. `isDue`, `renderDoctestFile`). That is tracked in `TODO.md`, as work for the `code-quality` checkup.

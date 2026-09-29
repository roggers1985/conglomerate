# 4. Use strict TypeScript for repository tooling

Date: 2026-09-29

## Status

Accepted

Supersedes the "plain JavaScript" part of [ADR-0003](0003-use-bun-for-repository-tooling.md).

## Context

ADR-0003 kept the scripts in plain JavaScript. Bun runs TypeScript directly, so switching costs almost nothing at runtime. The owner wants the compiler to catch as many mistakes as possible.

## Decision

- Repository tooling is written in TypeScript (`.ts`) and run directly by Bun. There is no build step.
- `tsc` is used only to type-check (`bun run typecheck`, with `noEmit`).
- `tsconfig.json` goes beyond `strict` and also enables:
  - `noUncheckedIndexedAccess`: indexed access may be `undefined`
  - `exactOptionalPropertyTypes`: an optional property is not the same as one explicitly set to `undefined`
  - `noPropertyAccessFromIndexSignature`: keys from an index signature must use bracket access
  - `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
  - `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `allowUnusedLabels: false`
  - `verbatimModuleSyntax`, `isolatedModules`, `erasableSyntaxOnly`: only syntax that can be stripped away, so Bun and `tsc` see the same code
  - `noUncheckedSideEffectImports`: side-effect imports must resolve
- Data from outside the program (JSON files, user input) is typed as `unknown` and narrowed through validation, never cast.
- Dev dependencies: `typescript` and `@types/bun`.

## Consequences

- Type errors are caught by `bun run typecheck`. Bun itself does not type-check when it runs code, so the typecheck must be part of any quality gate.
- The code is a bit more verbose (for example, more narrowing around indexed access). We accept that for safety.
- `skipLibCheck` stays on, so strictness applies to our own code and not to third-party type definitions.

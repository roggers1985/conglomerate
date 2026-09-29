# 5. Use Biome for linting and formatting

Date: 2026-09-29

## Status

Accepted

## Context

Strict TypeScript (ADR-0004) catches type errors, but not style issues, suspicious patterns, or formatting drift. The owner has explicit style rules, such as always using curly braces, avoiding nesting and preferring early returns. Agents should be held to these rules by a tool, not by memory.

## Decision

- [Biome](https://biomejs.dev) is the single tool for linting, formatting and import sorting. We do not use ESLint or Prettier.
- It is installed as the dev dependency `@biomejs/biome` and configured in `biome.json`.
- Formatting: 4 spaces, 120-character lines, double quotes, semicolons, trailing commas.
- Linting starts from the recommended rules and adds these as errors:
  - `useBlockStatements`: always use curly braces
  - `noUselessElse`: prefer early returns
  - `noExcessiveCognitiveComplexity`: flags deeply nested code
  - `noNonNullAssertion`, `noExplicitAny`: no escape hatches from the type system
  - `useImportType`, `useExportType`: type-only imports and exports, as `verbatimModuleSyntax` requires
  - `useConst`, `noParameterAssign`, `useTemplate`, `useNodejsImportProtocol`, `noUnusedImports`, `noUnusedVariables`
- `useLiteralKeys` is turned off because it conflicts with `noPropertyAccessFromIndexSignature` in the TypeScript config, which requires bracket access for index-signature keys.
- Biome respects `.gitignore`.

## Consequences

- `bun run lint` checks everything. `bun run lint:fix` applies safe fixes and formats the code.
- Linting becomes a quality gate, next to the typecheck and the tests.
- Biome has fewer rules than ESLint plus plugins, but it is much faster and needs one config file instead of several.

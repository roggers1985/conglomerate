# 29. Naming rules in the linter

Date: 2026-09-29

## Status

Accepted

Amends [ADR-0005](0005-use-biome-for-linting-and-formatting.md).

## Context

The owner asked for a consistency checkup (file names, code style and more). Mechanical consistency is better enforced continuously by tools than found monthly by a checkup. The code already passed Biome's naming rules. Conceptual consistency, which tools can't see, went into the `code-quality` checkup (ADR 0025).

## Decision

- **Biome's `useFilenamingConvention` (kebab-case) and `useNamingConvention` are errors.**
- **Exceptions** are a `biome-ignore` comment with the reason. The only one today is a test that deliberately uses an invalid task name.
- **There is no separate consistency checkup.** Recurring consistency findings from `code-quality` become lint rules or validator checks where possible.

## Consequences

- Naming can't drift: the pre-commit and pre-push hooks and CI reject violations.

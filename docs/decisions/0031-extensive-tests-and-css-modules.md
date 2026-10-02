# 31. Extensive tests, and CSS Modules by default

Date: 2026-09-29

## Status

Accepted. Extended by [ADR-0041](0041-conventions-checkup-first-round.md): web-first assertions in Playwright tests. Extended by [ADR-0059](0059-clean-test-output.md): test output is clean.

## Context

The owner wants two more conventions.
- **Styling:** frontend styling should follow the project's own approach, or use CSS Modules when a project has none, because CSS frameworks and CSS-in-JS libraries can go out of date.
- **Tests:** tests should be extensive: unit tests covering every edge case, integration and component tests covering most of the surface, and Playwright end-to-end tests for at least the happy paths.

## Decision

### Styling (`code-styling` skill, summary in `core.md`)

- Follow the project's existing approach, and never add a second one next to it.
- Without one: CSS Modules next to each component, with design tokens as custom properties in one global file, and modern native CSS (nesting, container queries, `:has()`, logical properties, `color-mix()`, cascade layers).
- State is styled through ARIA and data attributes, so the styles follow the accessible state.
- No CSS framework, CSS-in-JS runtime or component library without the owner's decision.

### Tests (`code-testing` skill rewritten, summary in `core.md`)

- **Levels:**
  - unit tests for every function with logic and every edge case;
  - integration tests with real collaborators;
  - component tests (Testing Library) for the largest possible part of the UI surface;
  - Playwright end-to-end tests for every key flow's happy path **and its critical failure paths** (validation, permissions, failing external services), with an axe scan per page.
- **"Every edge case" gets a method:**
  - equivalence classes and boundary values;
  - a fixed checklist (empty, unicode, time zones, numbers, invalid input, dependency errors, cancellation, concurrency);
  - property-based tests (`fast-check`) for pure functions with large input spaces.
- **Mocking only at the outer edges** (network, clock, randomness, file system), never the project's own modules.
- **A flaky test is a bug.**
- **Coverage** shows gaps, but doesn't prove quality. Mutation testing is noted as an option for critical code.

## Consequences

- More tests per change, and more work per feature, in exchange for fewer regressions. The `test-coverage` checkup already checks against these conventions.
- Projects that already use Tailwind or another approach keep it; the default only applies to new frontends.

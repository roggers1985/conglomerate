# 11. Accessibility testing

Date: 2026-09-29

## Status

Accepted

## Context

The jobs project has an accessibility checkup and e2e accessibility tests. The owner finds that tooling valuable and wants it in the factory, together with a skill that makes sure frontend work comes with accessibility tests.

In the jobs project, `@axe-core/playwright` and `lighthouse` are installed. But the axe scan in `apps/web/e2e/accessibility.spec.ts` is commented out, and the active tests are hand-written Playwright checks (one `h1`, alt text, labels, button and link names, `lang`). Hand-written checks catch only what someone thought of. An axe scan checks many WCAG rules in one go.

## Decision

Accessibility is covered in two places. Both use the same three layers of tooling:

| Layer | What | Tool |
|---|---|---|
| 1. Component behaviour | Accessible names, roles, ARIA states, keyboard interaction and focus | Testing Library, queried by role and label, plus `user-event` |
| 2. Automated rule scan | Many WCAG 2.2 A/AA rules at once | `axe-core`: on the rendered component in unit tests, and in a real browser via `@axe-core/playwright` for pages (which also covers colour contrast) |
| 3. Audit score | Overall accessibility score per page | Lighthouse, in the checkup only |

- **Skill `accessibility-testing`**: loaded when Claude builds or changes frontend UI. It tells Claude which tests to write for which kind of change, using layers 1 and 2. When the project lacks the tools, it proposes adding them instead of silently skipping the tests.
- **Checkup `accessibility`** (generic, ADR-0010): runs the axe and Lighthouse suites, checks that the key pages are covered, and reviews key flows by hand against WCAG 2.2 AA.
- The plugin ships no npm dependencies (ADR-0007). The tools are installed in the project that needs them, after the owner agrees.

## Consequences

- Every UI change comes with tests that fail when names, roles, focus or WCAG rules break.
- Component-level axe runs in a simulated DOM, which can't judge colour contrast. That is why page-level scans in a real browser are still needed.
- Projects without a browser test setup (Playwright) only get layers 1 and 2 at component level until the owner adds one.
- The jobs project should enable its axe scan. That is an item for its own accessibility checkup.

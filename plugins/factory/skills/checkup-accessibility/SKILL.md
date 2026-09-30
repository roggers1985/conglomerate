---
name: checkup-accessibility
description: Accessibility checkup. Runs the automated accessibility suites (axe, Lighthouse), checks that key pages are covered, reviews key flows against WCAG 2.2 AA, and checks that interactive components have accessibility tests. Use for "accessibility checkup", "a11y checkup", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: accessibility

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps the UI usable for everyone. It uses the same tools as the `code-accessibility` skill (ADR 0011).

## When it applies

Projects with a user interface. When the project has none, write a short report saying so ("Not applicable"), and propose removing this checkup from the schedule under "Needs a human".

## In scope

1. **Automated suites**:
   - run the page-level scans (axe via `@axe-core/playwright`, Lighthouse accessibility) and report violations and scores, compared with the previous report;
   - check that the scans cover the important page types (home, main flows, forms, error pages).

   If the project has no such scans, propose adding them (see `code-accessibility`).
2. **Component tests**: interactive components (dialogs, menus, forms, async buttons) have behaviour and accessibility tests (`code-accessibility`).
3. **Manual review of key flows** (WCAG 2.2 AA):
   - keyboard-only use, focus order and visible focus;
   - focus handling in dialogs;
   - form labels and error messages;
   - live regions for loading and results;
   - heading order, link text, colour contrast.

## Fixes you may make yourself

- Missing labels, alt text, roles and focus handling, and contrast fixes that don't visibly change the design, with tests or scan coverage.
- Adding missing pages to existing scans.

## Allowed production access

None.

## Always "Needs a human"

- Colour or layout changes that visibly alter the design.
- Whether accessibility laws apply to the project (e.g. the European Accessibility Act): that belongs to a project-specific legal checkup (note it under "Outside scope").

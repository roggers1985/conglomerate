---
name: checkup-frontend-quality
description: Frontend quality checkup. Moves UI code to modern framework and CSS features, removes effect-driven state, checks server/client boundaries, component structure and the owner's React and UI conventions. Use for "frontend checkup", "modernise the frontend", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: frontend-quality

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps the UI code modern, simple and in line with the owner's UI conventions (`code-react`).

## When it applies

Projects with a user interface. When the project has none, write a short report saying so ("Not applicable"), and propose removing this checkup from the schedule under "Needs a human".

## In scope

1. **What's current**: the framework and library versions in use, and their release notes. Only recommend features that are stable in the installed versions.
2. **Effects that shouldn't be effects**:
   - derived state computed in an effect;
   - state copied from props;
   - event logic inside effects;
   - client-side fetches that could run on the server.
   Follow "You Might Not Need an Effect".
3. **Async UI**:
   - transitions for navigation and filters;
   - deferred values for expensive renders;
   - forms with the framework's action and optimistic-update APIs;
   - async buttons disabled with a loading state while pending (`code-react`).
4. **Server and client**: client boundaries as low in the tree as possible, no client code that only renders static content, and data fetched where the framework prefers it.
5. **Components**:
   - required props over optional ones;
   - semantic HTML over generic containers;
   - component size and responsibilities.
6. **CSS**:
   - modern features (container queries, `:has()`, logical properties, `color-mix()`);
   - theme variables instead of hard-coded colours;
   - leftovers from older framework or CSS-tool versions.

## Fixes you may make yourself

- Behaviour-preserving refactors in small steps, one component or pattern at a time, with tests.
- For anything visual, check the result in a browser at desktop and mobile width (the `run` skill, or the project's dev server).

## Allowed production access

None.

## Always "Needs a human"

- Changes to visual design, copy or user flows.
- Experimental framework flags and large migrations.

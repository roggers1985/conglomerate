---
name: code-react
description: The owner's React and UI conventions. Covers modern React, semantic HTML, pending states, required props, and effects and state (derive don't sync, events in handlers, effects only for outside systems, purity, the React Compiler). Use when writing, reviewing or refactoring React components, hooks, JSX/TSX, or HTML markup.
---

# React & UI conventions

- Always use modern React (19+): hooks, async transitions. No legacy patterns (class components, `forwardRef`, `defaultProps`).
- Use semantic HTML tags (`header`, `footer`, `form`, `ul`/`li`, `figure`, …) and ARIA attributes instead of generic `div`s wherever a semantic element fits.
- Buttons that trigger async work must show a loading state and be disabled while pending. Use `useTransition` and derive both from `isPending`.
- Prefer required props over optional ones: if a prop exists, callers must pass it explicitly instead of relying on hidden defaults.

## Effects and state

From React's "You Might Not Need an Effect" and "Rules of React". Effects that keep derived state in sync are the most common source of extra renders and out-of-sync state; the `frontend-quality` checkup looks for them.

- **Derive, don't sync.** A value that can be calculated from props and state is calculated during render; it is never copied into state and kept in step by an effect. Reset state by giving the component a `key`, not with an effect.
- **Events belong in event handlers.** Logic that runs because the user did something (including notifying a parent component) lives in the handler, not in an effect that watches state.
- **Effects synchronise with something outside React** (subscriptions, timers, non-React widgets, client-only fetching), and clean up after themselves (see `code-cancellation`). Use `useSyncExternalStore` for external stores, and `useEffectEvent` to read the latest values in an effect without re-running it.
- **Components and hooks are pure:** no side effects, and no mutation of props, state or hook arguments, during render. Hooks are called at the top level only.
- **With the React Compiler, no manual `useMemo`, `useCallback` or `memo`,** unless a measurement or a stable effect dependency needs it.

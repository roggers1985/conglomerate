---
name: react-conventions
description: The owner's React and UI conventions. Use when writing, reviewing or refactoring React components, hooks, JSX/TSX, or HTML markup.
---

# React & UI conventions

- Always use modern React (19+): hooks, async transitions. No legacy patterns (class components, `forwardRef`, `defaultProps`).
- Use semantic HTML tags (`header`, `footer`, `form`, `ul`/`li`, `figure`, …) and ARIA attributes instead of generic `div`s wherever a semantic element fits.
- Buttons that trigger async work must show a loading state and be disabled while pending. Use `useTransition` and derive both from `isPending`.
- Prefer required props over optional ones: if a prop exists, callers must pass it explicitly instead of relying on hidden defaults.

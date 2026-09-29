---
name: testing-conventions
description: The owner's testing conventions. Use when writing, reviewing or fixing unit, integration or UI tests.
---

# Testing conventions

- Add unit tests for each feature, even when not explicitly asked.
- Use Testing Library for UI and integration tests.
- Never test implementation details (class names, DOM structure, element counts). Query by user-facing semantics: text, roles, labels, ARIA state.

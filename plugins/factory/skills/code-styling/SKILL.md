---
name: code-styling
description: The owner's styling conventions for frontend projects. Use the project's existing styling approach; in a project without one, use CSS Modules with modern CSS and design tokens as custom properties. Use when writing or changing styles, choosing a styling approach for a new frontend, or reviewing CSS.
---

# Styling conventions

## Which approach

1. **Follow the project.** When the project already has a styling approach (Tailwind, Sass, CSS Modules, a component library), use it and follow its patterns. Don't introduce a second approach alongside it.
2. **No approach yet: CSS Modules.** One `.module.css` file next to each component, with the same kebab-case name (`apply-modal.tsx` → `apply-modal.module.css`), imported as `styles`. CSS Modules are plain CSS with local class names, supported natively by the common build tools (Vite, Next.js). There is no library that can go out of date, as a CSS framework or a CSS-in-JS runtime can.
3. **Don't add** a CSS framework, a CSS-in-JS runtime or a component library without the owner's decision.

## Design tokens

- Colours, spacing, font sizes, radii, shadows and breakpoints are custom properties in **one** global file (e.g. `styles/tokens.css`), on `:root`, with a dark theme through `prefers-color-scheme` or a theme attribute.
- Components only use tokens: `color: var(--color-text)`, never a hard-coded `#1a1a1a` or `13px`.
- Name tokens by purpose (`--color-danger`), not by value (`--red-500`).

## Modern CSS

Use what current browsers support natively instead of tooling:

- native nesting;
- container queries (`@container`) for components that adapt to their container, media queries only for the page layout;
- `:has()`, `:is()` and `:where()`;
- logical properties (`margin-inline`, `padding-block`, `inset-inline-start`), so layouts work in any writing direction;
- `color-mix()` and relative colours for variants of a token, instead of more tokens;
- `clamp()` for fluid sizes;
- cascade layers (`@layer reset, tokens, components`) to keep specificity predictable.

Check support against the project's browser targets before using something recent.

## Structure

- **Global CSS** is limited to a reset, the tokens and base element styles. Everything else is local to a component.
- **Class names** describe what an element is (`.header`, `.price`), not how it looks (`.bold-red`). They are written in camelCase in CSS Modules, so they read as `styles.primaryAction`.
- **State** comes from attributes where one exists (`[aria-expanded="true"]`, `:disabled`, `[data-state="open"]`), not from extra classes. The styles then follow the accessible state.
- Keep specificity flat: one class per selector where possible, no IDs, no `!important`.
- Motion respects `prefers-reduced-motion`; focus is always visible (`:focus-visible`).

## Tests

Tests never assert on class names or styles (see `code-testing`). Where a style carries meaning, test the state it reflects (`aria-expanded`, `disabled`) or the accessibility result (contrast in the page-level axe scan, `code-accessibility`).

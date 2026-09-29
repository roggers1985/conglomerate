---
name: accessibility-testing
description: Write accessibility (a11y) tests alongside frontend work. Use when creating or changing UI components, pages, forms, dialogs, menus or other interactive elements, or when asked to add or fix a11y tests.
---

# Accessibility testing

Every UI change ships with tests that fail when it becomes inaccessible. The target is WCAG 2.2 AA. The `testing-conventions` skill applies too: query by role, label and text, never by class names or DOM structure.

## 1. Check the tooling first

Look at `package.json` and the test setup to see which layers the project has (ADR 0011 of the factory plugin):

| Layer | Needs |
|---|---|
| Component behaviour | `@testing-library/react` (or the framework's variant), `@testing-library/user-event`, a DOM environment, `@testing-library/jest-dom` matchers |
| Component rule scan | `axe-core` |
| Page rule scan (real browser, includes colour contrast) | `@playwright/test`, `@axe-core/playwright` |

If a layer is missing, propose adding it (exact packages and setup) and ask before installing. Never skip the tests silently. If you can't write them, say which checks are missing.

## 2. Which tests for which change

| Change | Write tests that… |
|---|---|
| Any new or changed component | find its parts by role and accessible name (`getByRole("button", { name: "Save" })`), which already fails when the name is missing, and run an axe scan on the rendered component |
| Form | find every control by its label (`getByLabelText`), check that errors are announced (`aria-invalid`, error text linked with `aria-describedby`, or focus moved to the error) and that required fields are marked as required |
| Interactive widget (dialog, menu, tabs, combobox, disclosure) | drive it with the keyboard via `user-event`: Tab order, Enter/Space, Escape, and arrow keys as in the [ARIA APG pattern](https://www.w3.org/WAI/ARIA/apg/patterns/). Check that focus moves into a dialog and returns to the trigger on close. Check states through role queries (`getByRole("button", { expanded: true })`) |
| Async action | check the pending state is perceivable (button disabled and a busy label or `aria-busy`) and the result is announced (`role="status"` or `role="alert"`) |
| Images and icons | check meaningful images have alt text, decorative ones have `alt=""`, and icon-only buttons have an accessible name |
| New page or route | add the route to the page-level axe scan, and check there is exactly one `h1`, landmarks (`main`, `nav`), a document title and `lang` |
| Colours, theme or layout | run the page-level axe scan in a real browser; a simulated DOM can't judge contrast |

## 3. Examples

Component, with Testing Library, `user-event` and `axe-core`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";

it("has no axe violations", async () => {
    const { container } = render(<DeleteButton />);

    // Colour contrast needs a real browser; the page-level scan covers it.
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });

    expect(results.violations).toEqual([]);
});

it("closes the dialog with Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<DeleteButton />);
    const trigger = screen.getByRole("button", { name: "Delete" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Delete this item?" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
});
```

Page, with Playwright and `@axe-core/playwright`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/contact"];

for (const route of routes) {
    test(`${route} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(route);

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();

        expect(results.violations).toEqual([]);
    });
}
```

## Rules

- Fix the markup; never disable an axe rule or exclude an element just to get a test green. For a violation in third-party markup you can't change, exclude that one selector narrowly, with a comment explaining why.
- Prefer native elements (`button`, `a`, `label`, `dialog`) over ARIA on `div`s. The first rule of ARIA is not to use it when HTML can do the job.
- `axe-core` is tested against jsdom. If it misbehaves in the project's DOM environment (e.g. happy-dom), keep the component behaviour tests and move the rule scan to page level.
- Automated scans find only part of all accessibility problems. The keyboard and focus tests cover what axe can't see, so don't drop them because axe passes.

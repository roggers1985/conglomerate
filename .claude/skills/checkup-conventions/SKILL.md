---
name: checkup-conventions
description: Conventions checkup for the factory plugin. Re-reads the sources the owner's conventions come from (Power of 10, TigerStyle, Parse don't validate, the React docs, Testing Library, WCAG, …), looks for newer or better practices on the same topics, and checks the conventions for contradictions and rules that don't earn their place. Only proposes. Use for "conventions checkup", "are our conventions still right", or when the checkup runner dispatches it.
metadata:
  intervalDays: 90
  priority: quiet
  task: checkup
---

# Checkup: conventions

Follow the protocol in `plugins/factory/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

The owner's conventions live in `plugins/factory/conventions/core.md`, the `plugins/factory/skills/code-*` skills and the `writing-documentation` skill, and the reasons for them in `docs/decisions/`. The other checkups look inward: `code-quality` checks code against the conventions, `new-features` finds lint rules that enforce them, and `retro` turns recurring findings into new ones. This checkup looks outward, at where the conventions come from and what has changed or appeared since (ADR 0039).

**This checkup proposes changes; it never makes them.** Conventions are the owner's decision, and every change needs an ADR.

## The owner's principles for judging a practice

Weigh every proposal against these, and say how it fits:

- **Readability wins** when rules conflict (`core.md`).
- **Lead by logic, not by numbers:** a practice is adopted for the bugs it prevents, in the form that prevents them. A quota or a hard number without a reason invites dogmatism (ADR 0038).
- **Enforced beats remembered:** a rule a linter or type checker can enforce is worth more than one that relies on review.
- **Small surface:** a practice that duplicates an existing one, or applies so rarely that nobody will remember it, costs more than it adds.

## Primary sources

Read the current version of each, and cite it in the report. Where a source has a changelog or a history (TigerStyle is a file in a repository, for example), look at what changed since the last report's date.

| Topic | Source | Used in |
|---|---|---|
| Bounds, assertions, function length | NASA/JPL, "The Power of 10: Rules for Developing Safety-Critical Code" (Holzmann, 2006): https://spinroot.com/gerard/pdf/P10.pdf | `code-safety`, ADR 0032, 0034, 0038 |
| Bounds, assertions, errors, naming, negative space | TigerBeetle's TigerStyle: https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md | `code-safety`, `code-readability`, ADR 0017, 0019, 0032, 0038 |
| Parsing at the boundary | Alexis King, "Parse, don't validate": https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ | `code-parsing`, ADR 0020 |
| Schemas | Standard Schema: https://standardschema.dev, and Zod: https://zod.dev | `code-parsing`, ADR 0020 |
| React and effects | React's rules and "You Might Not Need an Effect": https://react.dev/reference/rules, https://react.dev/learn/you-might-not-need-an-effect | `code-react` |
| Component and end-to-end tests | Testing Library's guiding principles: https://testing-library.com/docs/guiding-principles, and Playwright's best practices: https://playwright.dev/docs/best-practices | `code-testing`, ADR 0031 |
| Accessibility | WCAG 2.2: https://www.w3.org/TR/WCAG22/, and the ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/patterns/ | `code-accessibility`, ADR 0011 |
| Documentation | TSDoc: https://tsdoc.org | `code-documentation`, ADR 0016 |
| Cancellation | `AbortSignal` on MDN: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal, and Go's `context`: https://pkg.go.dev/context | `code-cancellation`, ADR 0012 |
| SQL | PostgreSQL's documentation: https://www.postgresql.org/docs/current/, and SQLite's STRICT tables: https://www.sqlite.org/stricttables.html | `code-sql`, ADR 0036 |
| Licenses | The SPDX license list: https://spdx.org/licenses/ | `core.md`, ADR 0035 |
| Lint rules | Biome's rule list: https://biomejs.dev/linter/javascript/rules/ | `biome.json`, ADR 0005, 0038 |

If a page has moved, find its new address and note it in the report (under "Next time", so this list gets updated). A convention whose source isn't in this table is either the owner's own preference, which is fine, or a missing row: say which.

## In scope

1. **Changes in the sources:** what changed in each source since the last run, and whether a convention built on it should follow. Quote the change and name the convention it affects.
2. **Newer or better practices:** on the topics above, look for guidance that has become widely adopted or authoritative since the last run: official documentation, standards bodies, and style guides of well-regarded projects. For each candidate: the source, the bug or cost it prevents, how it fits the principles above, and where it would go (`core.md`, which skill, or a lint rule). Three well-argued candidates beat ten thin ones; none is a fine answer.
3. **Contradictions:** between `core.md` and the skills, between skills, between the conventions and the accepted ADRs, and between the conventions and `biome.json` or `tsconfig.json` (a rule that says one thing while the linter enforces another).
4. **Rules that don't earn their place:** conventions that the code keeps deviating from (look for suppressions, and for deviations that reviews or checkup reports accepted), that never apply, or that turned out to be dogmatic. Propose to sharpen, merge or drop them.
5. **Enforcement:** conventions that are only enforced by review, where a lint rule, a type or a test could enforce them now. Leave new lint rules for well-known conventions to `new-features`; report here only what that checkup can't see, such as a convention that could become a helper in `lib/`.

## Fixes you may make yourself

- Correct moved URLs in the table above.
- Nothing else: no changes to `core.md`, the skills, the ADRs or the lint configuration.

## Always "Needs a human"

- Every proposed change to a convention, with the exact text, where it goes, and the ADR it needs (new, or one it would amend or supersede).

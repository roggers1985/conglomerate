---
name: writing-documentation
description: How to write documentation for people, and who each document is for, by where it lives. Covers what and why first, the conclusion at the start, short sentences, one idea per paragraph, plain words and explained terms, lists and tables for structure, references at the end of a point, and keeping full precision, with before-and-after examples. Use when writing or reviewing documentation meant for people (READMEs, ADRs, intents, specs, plans, verification, reviews, checkup reports, readiness) or the text in templates for them.
---

# Writing documentation for people

The owner doesn't read all the code agents write. The documentation is how they keep an overview, so it has to be easy to read.

## Who a document is for

Where a document lives decides who it is written for.

| Location | Written for | What that means |
|---|---|---|
| `docs/` (except `task.md`), `README.md`, `GLOSSARY.md`, `TODO.md` | people first | Follow this skill. It stays usable for agents. |
| `CLAUDE.md`, a change's `task.md`, and the plugin's `skills/`, `conventions/`, `agents/`, `commands/` and `checkups/` | agents first | Concise and direct. No style change required. |
| Generated files (`CATALOG.md`, bundles, notices) | n/a | Out of scope: the generator rewrites them. |

A file in none of these rows: ask who reads it first, and propose adding it here.

Most documents are read by both. Text that is readable for people is also clearer for agents. Code comments and TSDoc follow `code-documentation`.

## How to write

- **What it's about and why, first.** Open a document or section with its subject and its purpose. Details come after.
- **The conclusion at the start of a paragraph,** not the end. The reader should know the answer before the reasoning.
- **Short sentences.** Split a sentence that carries several ideas, or joins them with semicolons.
- **One idea per paragraph.**
- **Plain words.** Explain a term where it first appears, in a few words.
- **Lists and tables for structure.** Steps, options and comparisons read better as a list or table than as long prose.
- **References at the end of a point.** ADRs, files and links go after the statement they support, not in the middle of a sentence. A path that names the subject itself isn't a reference: keep it next to what it names.
- **No loss of precision.** Readable is not vaguer. Keep every number, name, path and condition. Specs and ADRs stay exact.

There are no numeric limits, such as words per sentence: a count invites counting instead of writing well ("lead by logic, not by numbers", ADR 0038).

## Examples

**Dense: several ideas, semicolons, a path in the middle.** From the pr-body plan:

> A pure renderer turns a change's parsed documents into the description; a thin command collects the inputs, refuses what isn't ready, and prints. All of it in unit `factory` (`plugins/factory/scripts/`), no new dependencies.

Better:

> The description is built in two parts:
>
> - a **renderer**: a pure function (no I/O, same input gives the same output) that turns the change's parsed documents into the description;
> - a **command**: it collects the inputs, refuses a change that isn't ready, and prints the result.
>
> Both live in unit `factory`, in `plugins/factory/scripts/`. They need no new dependencies.

**The conclusion at the end, a reference in the middle.**

> After comparing `bun outdated` with each package's release notes (see `docs/checkups/2026-09-01-outdated-packages.md`), it turned out that three packages, of which only zod has a new major version, can be updated safely.

Better:

> Three packages can be updated safely. Only zod has a new major version. Found by comparing `bun outdated` with each package's release notes (`docs/checkups/2026-09-01-outdated-packages.md`).

**Readable, but vaguer: wrong.** From the pr-body plan:

> git runs with an argument list, never through a shell, with the caller's signal plus a timeout.

Wrong: "git runs safely." It drops what makes it safe.

Better:

> git runs with an argument list, never through a shell. It takes the caller's signal and a timeout, so it can be cancelled and can't hang.

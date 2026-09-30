# 39. Conventions checkup

Date: 2026-09-30

## Status

Accepted

## Context

The owner's conventions (`core.md` and the `code-*` skills) come from outside sources: NASA/JPL's "Power of 10", TigerBeetle's TigerStyle, "Parse, don't validate", the React documentation, Testing Library, WCAG, and others. Three checkups already touch the conventions, but all of them look inward:
- `code-quality` checks the code against them;
- `new-features` finds lint rules that enforce them;
- `retro` turns recurring findings into new ones.

Nothing noticed when a source changed (TigerStyle is a living document), when a better practice appeared elsewhere, or when conventions started to contradict each other. The owner asked for a way to reconsider the conventions and their sources, so that something better can be adopted when it comes along.

## Decision

- **A `conventions` checkup specific to this repository,** in `.claude/skills/checkup-conventions/`, because the conventions live here. It runs every 90 days with priority `quiet`, since these sources change slowly.
- **It keeps the list of sources:** each convention's source, with a link, lives in a table in the checkup skill. The skills themselves stay lean.
- **What it does:**
  - re-reads the sources for changes;
  - looks for newer, widely adopted practices on the same topics;
  - checks the conventions for contradictions with each other, with the ADRs and with the lint and type-check configuration;
  - flags rules that don't earn their place: ones that are often deviated from, never apply, or turned out to be dogmatic.
- **It judges by the owner's principles:** readability wins; lead by logic, not by numbers (ADR 0038); enforced beats remembered; keep the surface small.
- **It only proposes.** It may fix moved URLs in its own source table. Every change to a convention goes to the owner and needs an ADR.

## Consequences

- Where each convention comes from is written down in one place.
- Once a quarter, the conventions get an outside check.
- The owner decides on its proposals like the `retro` checkup's: nothing changes by itself.

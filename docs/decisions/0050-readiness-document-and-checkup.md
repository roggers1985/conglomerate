# 50. Readiness document and checkup

Date: 2026-09-30

## Status

Accepted

## Context

`TODO.md` said to compare the factory with other open-source factories, and to make the repository public only if it clearly adds something. Answering "where does the plugin stand?" meant a fresh round of research every time. The owner wants one document to read instead, kept current, that shows when the plugin has enough going for it to be published.

## Decision

- **`docs/readiness.md`:**
  - the criteria for "ready", with their status;
  - a comparison with the alternatives: facts with sources and dates, kept apart from the interpretation;
  - where the factory is ahead and where it lags;
  - a verdict;
  - what couldn't be verified.

  The first version comes from a research run on 2026-09-30.
- **Kept current in two ways:**
  - Claude updates it whenever a milestone is finished, such as a factory stage. This is written into the working agreement in `CLAUDE.md`;
  - a `readiness` checkup for this repository (every 60 days, `normal`, task type `research`) refreshes the facts about the alternatives, which change monthly.
- **The criteria and a "ready" verdict are the owner's.** The checkup updates facts and statuses, and proposes changes to the criteria or to the factory itself.
- **The first verdict is "not ready yet"**, with two paths:
  - build the delivery stages in a first form;
  - or publish sooner as a health and conventions pack alongside a delivery workflow such as Superpowers or Spec Kit.

  Either way, it needs the packaging criteria (install, walkthrough, releases, security statement, support route).

## Consequences

- The owner can read where the plugin stands at any time.
- One more checkup, of the cheaper `research` type, runs every 60 days.
- The document is meant to be temporary: once the plugin is published, it can be archived or turned into a public comparison page.

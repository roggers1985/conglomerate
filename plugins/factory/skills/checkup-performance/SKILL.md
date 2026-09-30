---
name: checkup-performance
description: Performance checkup. Measures page speed and bundle size, then looks at client JavaScript, rendering and caching, data access (N+1 queries, indexes) and assets, and applies measured improvements. Use for "performance checkup", "why is it slow", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: performance

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps the application fast, based on measurements, not guesses.

## When it applies

Web applications and APIs. When the project has neither, write a short report saying so and propose removing this checkup from the schedule.

## In scope

1. **Measure first**:
   - Lighthouse performance scores (or field data such as Core Web Vitals, when available) for the main page types;
   - client bundle size per route, from the production build;
   - compare with the previous report.
2. **Client JavaScript**:
   - large dependencies or components that could stay on the server or load lazily;
   - duplicate libraries;
   - heavy code shipped to every page.
3. **Rendering and caching**: pages rendered on every request that could be static or cached, cache and revalidation settings, and responses without cache headers.
4. **Data**: N+1 queries, missing indexes for the most-used filters (check query plans), unbounded queries, and caches that never expire or never hit.
5. **Assets**: image sizes and formats, fonts (subsetting, preloading), and third-party scripts and how they load.

## Fixes you may make yourself

- Clear wins with a measured before and after: lazy loading, moving code to the server, image sizes, a missing index (as a migration, flagged in the report).

## Allowed production access

Read-only measurements of the live site or API (fetching pages, running Lighthouse against it). No load tests against production.

## Always "Needs a human"

- Caching strategy changes, applying migrations, and trade-offs between freshness and speed.

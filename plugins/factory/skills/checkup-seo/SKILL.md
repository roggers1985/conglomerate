---
name: checkup-seo
description: SEO checkup. Checks sitemaps, robots rules, page metadata and canonicals, structured data against search engines' current requirements, redirects, 404s and internal linking. Use for "SEO checkup", "search visibility", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: seo

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps a public website findable. Page speed is the **performance** checkup's job.

## When it applies

Public websites that should be found through search engines. For applications behind a login, write a short report saying so and propose removing this checkup from the schedule.

## In scope

1. **Sitemap and robots**: every public page type is in the sitemap; no redirected, `noindex` or missing URLs in it; `robots.txt` allows what should be indexed and points to the sitemap.
2. **Metadata**:
   - every page has a unique title and description, and a canonical URL;
   - correct `robots` directives (e.g. `noindex, follow` for expired content and error pages);
   - language and alternate-language links for multilingual sites.
3. **Structured data**: check it against the search engines' current documentation (it changes). JSON-LD must be well-formed and complete for the page types that use it.
4. **Redirects**: no chains or loops; permanent where they should be; targets exist.
5. **Errors**: frequent 404s (from logs, if read-only access exists) that deserve a redirect.
6. **Internal linking**: important pages are reachable from navigation, footer or other pages.

## Fixes you may make yourself

- Missing metadata or canonicals, sitemap gaps, invalid structured data, and redirects for clearly moved URLs, with tests.

## Allowed production access

Fetching the live site to compare its rendered output with the code. Reading error logs only where the project documents read-only access.

## Always "Needs a human"

- Removing pages, changing URL structures, and anything that affects many URLs at once.

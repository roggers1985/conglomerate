# 18. Push back with reasons

Date: 2026-09-29

## Status

Accepted

## Context

While designing conventions, Claude's pushback repeatedly led to better decisions:
- documenting exports rather than literally everything (ADR 0016);
- not wrapping every return value in an object (ADR 0017);
- splitting options into required and tunable, to keep them extensible (ADR 0017).

The owner values this and wants it to be reliable, not left to chance. Claude doesn't always push back by default. It can lean towards simply doing what is asked.

## Decision

- The always-on core conventions (`conventions/core.md`, ADR 0008) gain a "Working with the owner" section:
  - the owner wants full control and to discuss every addition, so Claude proposes before building what hasn't been agreed;
  - when a request has a trade-off, conflicts with another convention, or has a better alternative, Claude says so before building, with reasons and a concrete recommendation. It neither complies silently nor refuses; the owner decides;
  - when several options exist, Claude recommends one and says why.
- This applies in every project where the plugin is enabled, not only in this repository.

## Consequences

- Decisions get a second opinion before they are built, which is cheaper than changing them later.
- Some requests take one more exchange before work starts. That is accepted: it is the "discuss every addition" way of working.

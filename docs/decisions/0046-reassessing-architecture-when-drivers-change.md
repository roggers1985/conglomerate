# 46. Reassessing architecture when its drivers change

Date: 2026-09-30

## Status

Accepted

Extends [ADR-0045](0045-architecture-checkup-and-register.md).

## Context

In ADR 0045, a rejected architecture proposal comes back only when its reconsider condition is met or new evidence appears. That evidence comes from the code and git history. The owner pointed out that the need for a new architecture can also come from outside the code: business requirements change, and so do plans and expected load, while the architecture stays the same. Git history shows that only once the pain has arrived.

## Decision

- **Drivers are recorded.** The register gets a Drivers section: per unit, what the architecture has to serve (key requirements, expected load and growth, planned features, the team), each marked confirmed by the owner or unconfirmed. Every proposal lists the drivers it depends on.
- **Each run starts with the drivers:**
  - it compares them with the project's sources: README, product docs, the roadmap, `TODO.md`, and open issues and milestones;
  - it asks the owner, under "Needs a human", to confirm what it can't check itself, and never guesses them;
  - a changed driver reopens every decision that depends on it, even without new evidence in the code.
- **Pain that is coming counts as evidence:** a planned feature or changed requirement that the current architecture would make hard.
- **Accepted risk expires after 12 months.** The next run re-confirms it: briefly when nothing changed, and as a full proposal when something did.

## Consequences

- A decision not to change the architecture holds only as long as the reasons for it hold, and those reasons are written down.
- The owner answers a few questions about the drivers after a run. Those answers are what let the checkup see business changes.
- A decision can be reopened more often than on code evidence alone. The 12-month expiry and the listed drivers keep that deliberate rather than constant.

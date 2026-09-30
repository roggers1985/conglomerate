---
name: checkup-readiness
description: Readiness checkup for the factory plugin. Refreshes docs/readiness.md, the comparison of the factory with alternatives such as Superpowers, Spec Kit, OpenSpec, BMAD, Kiro and Anthropic's AI-native SDLC playbook, and re-checks the criteria for publishing it to a public marketplace. Use for "readiness checkup", "is the plugin ready to publish", "how does it compare now", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: research
---

# Checkup: readiness

Follow the protocol in `plugins/factory/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

`docs/readiness.md` tells the owner where the factory stands compared with the alternatives, and what's missing before it's worth publishing (ADR 0050). The alternatives change monthly, so this checkup keeps the document current. Its report is short; **the document is the real output.**

## In scope

1. **The factory's own state:** re-derive the factory column and the criteria table from the repository: `README.md`, `CATALOG.md`, `TODO.md`, the ADRs added since the last run, and `git log` since the document's "Last updated" date. Mark criteria that were met since then.
2. **The alternatives:** for each project in the comparison, refresh its facts from primary sources (its repository through `gh api repos/<owner>/<repo>` and its releases; its own documentation): licence, stars, latest release, hosts, and changes to what it covers. Add a project that has become comparable and widely used; drop one that is archived or abandoned, and say so.
3. **The "Not verified" list:** try to resolve its items, starting with Anthropic's official marketplace submission requirements.
4. **The verdict:** update it when the facts changed it. Keep facts and interpretation apart, as the document does.

## Fixes you may make yourself

- Update `docs/readiness.md`: facts, the criteria's status, "Last updated", and the verdict. Keep its structure.

## Always "Needs a human"

- A verdict that changes to "ready", or a criterion that should be added, dropped or changed: the criteria are the owner's.
- Anything that suggests a change to the factory itself (a feature to build, a positioning choice): propose it, don't build it.

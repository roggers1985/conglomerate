---
name: checkup-new-features
description: New features checkup. Finds features of the language, runtime, framework, libraries and tools that became available since the last run and would improve this codebase, adopts clear wins, and revisits settings and lint rules. Use for "new features checkup", "what can we modernise", after major releases, or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: new-features

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps the codebase using its tools well. It adopts *features*; updating versions is the **outdated-packages** checkup's job.

## In scope

1. **Inventory**: the versions of the language (e.g. TypeScript), runtime (Bun, Node), framework(s), main libraries and tools (linter, formatter, test runner, bundler) that the project uses.
2. **What's new**: read the release notes and changelogs since the versions reviewed in the previous report (or of the last year, on a first run). List features that are **stable in the installed versions** and relevant to this code.
3. **Where they fit**: find code that would get simpler, safer or clearer with them. For example:
   - language features such as `Object.groupBy`, `Array.prototype.toSorted`, `using` declarations, `Promise.withResolvers`;
   - runtime APIs that replace a dependency or a helper;
   - framework features that replace workarounds.
4. **Settings and rules**: new strictness flags in the type checker, and new lint rules that match the owner's conventions.
5. **Deferred decisions**: everything an ADR or a comment deferred until later: rules turned off because of tool bugs, and choices made "for now" (e.g. Zod in ADR 0020). Check whether the reason still holds. Changing a choice is a decision for the owner.

## Fixes you may make yourself

- Adopt clear wins in small, behaviour-preserving steps, with tests.
- Turn on a new rule or flag when the code already passes, or passes after small fixes.
- Record in the report which features were adopted and which were considered and rejected, and why, so the next run doesn't reconsider them.

## Allowed production access

None.

## Always "Needs a human"

- Experimental features and flags, migrations that touch many files, and anything that changes a convention or contradicts an ADR.

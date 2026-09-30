---
name: checkup-unused-code
description: Unused code checkup. Finds and removes unused dependencies, files, exports, scripts, assets and leftovers such as commented-out code and always-on feature flags. Use for "unused code checkup", "dead code", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: normal
  task: checkup
---

# Checkup: unused-code

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Less code is less to read, test and update. This checkup removes what nothing uses.

## In scope

1. **Dependencies**, per workspace:
   - dependencies nothing imports;
   - imports missing from `package.json` that only work because of hoisting.

   Tools help: `bunx knip` for JavaScript/TypeScript, `deadcode` for Go, `vulture` for Python, `cargo machete` for Rust.
2. **Files and exports**:
   - modules nothing imports;
   - exports used only inside their own module (make them internal; see `code-documentation`) or only by tests;
   - components nothing renders.
3. **Scripts**: `package.json` scripts (or Makefile targets) that point at files or commands that no longer exist.
4. **Assets**: public files nothing references. Check the code *and* seed data or content before removing.
5. **Leftovers**: commented-out code, and feature flags that are always on.

## Not unused

- Exports that exist so the doctest enforces documentation and tested examples on them, or so tests can reach them (common in command-line entry points), are used.
- Helpers the owner asked for explicitly are kept, even while nothing uses them yet (see the protocol).

## Fixes you may make yourself

- Remove what is clearly unused, in small commits per category, running the full checks after each.
- Always confirm a tool's finding with a search before removing it: things can be used from config files, scripts or other tools.

## Allowed production access

None.

## Always "Needs a human"

- Anything that may be used dynamically (built import paths, environment-based loading, public URLs, external callers), and removing whole packages or public routes.

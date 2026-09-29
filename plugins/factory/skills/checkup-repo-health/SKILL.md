---
name: checkup-repo-health
description: Repository health checkup. Checks CI (failures, speed, pinned actions, permissions), skipped, focused and flaky tests, git hooks, stale branches and pull requests, and repository hygiene. Use for "repo health checkup", "CI checkup", or when the checkup runner dispatches it.
metadata:
  task: checkup
---

# Checkup: repo-health

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps the machinery around the code healthy: CI, tests, hooks and branches.

## In scope

1. **CI** (`.github/workflows`, or the CI in use):
   - recent runs on the default branch pass (`gh run list`);
   - duration trend, and caching;
   - third-party actions pinned to a full commit SHA;
   - workflow `permissions` as narrow as possible.
2. **Tests**:
   - skipped tests (`.skip`, `xit`, `it.todo`) and focused tests (`.only`);
   - flaky tests: run the suite three times and compare;
   - tests that depend on order or time.
3. **Git hooks**: installed (e.g. `git config core.hooksPath`), and they run and pass.
4. **Branches and pull requests**:
   - merged branches that still exist;
   - unmerged branches and open pull requests older than 30 days, including old `checkup/*` branches.
5. **Hygiene**:
   - `.gitignore` covers build output and local files;
   - no large or generated files committed by accident;
   - the lockfile is committed and in sync.

## Fixes you may make yourself

- Remove focused tests (`.only`).
- Pin actions, narrow workflow permissions, fix broken hooks and `.gitignore` gaps.

## Allowed production access

None.

## Always "Needs a human"

- Deleting branches or closing pull requests: list them with their age and state.
- Un-skipping or fixing flaky tests when the fix isn't obvious.

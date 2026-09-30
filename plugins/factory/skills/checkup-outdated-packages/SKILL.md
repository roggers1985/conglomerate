---
name: checkup-outdated-packages
description: Outdated packages checkup. Lists outdated dependencies, applies safe patch and minor updates in small verified batches, and writes an upgrade plan for major versions based on release notes. Use for "update packages", "outdated dependencies checkup", or when the checkup runner dispatches it.
metadata:
  intervalDays: 30
  priority: normal
  task: checkup
---

# Checkup: outdated-packages

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

This checkup keeps dependencies current so upgrades never pile up. Security advisories belong to the **security** checkup; list them under "Outside scope" if you run into them.

## First, find out what the project uses

- The package manager(s), from lockfiles: `bun.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, and for other ecosystems e.g. `Cargo.lock`, `uv.lock`, `go.sum`.
- Workspaces or monorepo packages, so you cover every `package.json` (or equivalent), not just the root.
- The project's check commands (see the protocol).

## In scope

1. **Inventory**: list outdated dependencies per workspace (`bun outdated`, `npm outdated`, `pnpm outdated`, … for the package manager in use). Group them into patch, minor and major.
   - When everything is current, `bun outdated` prints only its version line and no table. That is the "nothing outdated" result; there is no need to double-check each package.
2. **Consistency**: the same package at different versions across workspaces, and loose ranges (`"*"`, `"latest"`, missing lockfile entries) that make installs unpredictable.
3. **Patch and minor updates**: apply them in small batches (related packages together, e.g. `@types/*`, a framework and its plugins), reinstall, and run the full checks. Commit per batch, so a failing batch is easy to drop. For `0.x` packages a minor version can break things: read the changelog first.
4. **Majors**: don't apply them. For each one, write a short plan in the report: what breaks according to the release notes and migration guide, which files are affected (search for the APIs involved), rough effort, and what it unlocks. Pay extra attention to the framework, the test runner, the type checker and the linter.
5. **Tooling versions**: the runtime (Bun, Node) and its pinned version (`engines`, `.nvmrc`, `.bun-version`, `packageManager`), and versions of CI actions in `.github/workflows`.
   - A pinned version that is behind is a finding.
   - A project without a pin is not a finding by itself. Propose a pin once, as a low-severity "Needs a human" item, and don't repeat it in later runs unless the owner asked for one.

## Checks after every batch

Reinstall, then run all of the project's checks (typecheck, lint, tests, and the build if there is one). A batch whose checks fail is either fixed with a small, obvious change or dropped and listed under "Needs a human".

## Allowed production access

None.

## Always "Needs a human"

- Every major upgrade.
- Any update that needs code changes beyond a rename, or that breaks checks in a way that isn't trivial to fix.
- Changing the runtime version or the package manager.

# 27. MIT license and generated third-party notices

Date: 2026-09-29

## Status

Accepted

## Context

The first `licenses` checkup found two things.
- **No license:** the project had no license of its own. That is fine while the repository is private, but it must be decided before it becomes public.
- **Missing notice:** the plugin's bundles inline Zod (MIT) without its copyright notice, which the MIT license requires in every copy.

The checkup added a hand-written notices file. The owner chose MIT for the project, and wants the notices generated.

## Decision

- **The project is licensed under MIT,** in a root `LICENSE`, and declared as `"license": "MIT"` in `package.json` and `plugin.json`. The repository stays private until the owner decides otherwise.
- **`bun run generate` also writes the plugin's legal files into `plugins/factory/`,** because only that folder is distributed:
  - `LICENSE`: a copy of the root license;
  - `THIRD-PARTY-NOTICES.md`: for every package the bundles inline, its version, license and full license text.
- **Which packages are bundled comes from Bun's build metadata** (`metafile`), so the notices can't miss a package or list one that isn't bundled. Generation fails when a bundled package declares no license or ships no license file.
- **`bun run validate` checks** that both files are up to date, like the other generated files. An updated dependency (a new version) therefore requires regenerating.
- **Cleanup:** `renderBundles` now sets `throw: true` explicitly and no longer has a `success: false` branch, which the `test-coverage` checkup found to be unreachable.

## Consequences

- Adding a dependency that ends up in a bundle automatically adds its notice. Adding one without a license stops the build, so it can't slip in unnoticed.
- The `licenses` checkup checks that the generated notices exist and are current, instead of writing them.

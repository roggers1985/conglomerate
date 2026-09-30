---
name: checkup-licenses
description: Licenses checkup. Checks the project's own license, the licenses of its dependencies and bundled code against how the project is used and distributed, and required attributions. Use for "license checkup", "can we use these dependencies", or when the checkup runner dispatches it.
metadata:
  intervalDays: 90
  priority: quiet
  task: checkup
---

# Checkup: licenses

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Makes sure the project may use and distribute what it depends on. You are not a lawyer: find risks and inconsistencies, cite the license texts, and leave judgements to the owner.

The owner's policy (ADR 0035): only permissive open-source licenses (MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, MIT-0, Unlicense, CC0-1.0, Zlib, BlueOak-1.0.0), for every dependency including development tools. Copyleft, source-available, non-commercial, proprietary and unknown licenses are findings.

## In scope

1. **The project's own license**: a `LICENSE` file exists and matches the license declared in `package.json` (or the ecosystem's equivalent), or the project is deliberately unlicensed/private.
2. **Dependency licenses**: list them with the ecosystem's tool, or from the installed packages' metadata. Flag:
   - every license outside the owner's allowlist (ADR 0035), and licenses with obligations that conflict with how the project is used or distributed;
   - missing or unknown licenses;
   - non-commercial or source-available licenses;
   - licenses that changed since the previous report.
3. **Bundled and vendored code**: code copied into the project, or bundled into files the project distributes, keeps its required license notices. Where the notices are generated (as in the factory's own repository, ADR 0027), check that generation covers every bundled package, rather than editing the output.
4. **Assets**: fonts, images and icons have a license that allows their use.

## Fixes you may make yourself

- Add missing license notices and attribution files for code the project already uses.
- Correct the declared license field when the `LICENSE` file is clearly authoritative.

## Allowed production access

None.

## Always "Needs a human"

- Every judgement about whether a license is acceptable, choosing or changing the project's license, and replacing a dependency because of its license.

---
name: checkup-licenses
description: Licenses checkup. Checks the project's own license, the licenses of its dependencies and bundled code against how the project is used and distributed, and required attributions. Use for "license checkup", "can we use these dependencies", or when the checkup runner dispatches it.
metadata:
  task: checkup
---

# Checkup: licenses

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Makes sure the project may use and distribute what it depends on. You are not a lawyer: find risks and inconsistencies, cite the license texts, and leave judgements to the owner.

## In scope

1. **The project's own license**: a `LICENSE` file exists and matches the license declared in `package.json` (or the ecosystem's equivalent), or the project is deliberately unlicensed/private.
2. **Dependency licenses**: list them with the ecosystem's tool, or from the installed packages' metadata. Flag:
   - licenses with obligations that conflict with how the project is used or distributed (e.g. GPL or AGPL in distributed or network-served code);
   - missing or unknown licenses;
   - non-commercial or source-available licenses;
   - licenses that changed since the previous report.
3. **Bundled and vendored code**: code copied into the project, or bundled into files the project distributes, keeps its required license notices.
4. **Assets**: fonts, images and icons have a license that allows their use.

## Fixes you may make yourself

- Add missing license notices and attribution files for code the project already uses.
- Correct the declared license field when the `LICENSE` file is clearly authoritative.

## Allowed production access

None.

## Always "Needs a human"

- Every judgement about whether a license is acceptable, choosing or changing the project's license, and replacing a dependency because of its license.

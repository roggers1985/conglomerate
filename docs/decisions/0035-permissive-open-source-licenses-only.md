# 35. Permissive open-source licenses only

Date: 2026-09-29

## Status

Accepted. Clarified by [ADR-0037](0037-daily-monitoring-checkup-and-opting-out.md): external services a project uses are outside the policy.

## Context

The owner wants to use only open-source tools, and never licenses "with any form of limitation". Every license has some conditions (even MIT requires keeping its notice), so the workable reading is: **permissive open-source licenses only**. These allow use, modification and distribution for any purpose, and ask little more than attribution. The first `licenses` checkup found only MIT and Apache-2.0 licenses in use.

## Decision

- **Allowlist,** as SPDX identifiers: MIT, MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, Unlicense, CC0-1.0, Zlib, BlueOak-1.0.0.
- **Refused:**
  - copyleft (GPL, AGPL, LGPL, MPL, EPL): they place obligations on the owner's own code;
  - source-available (BSL, SSPL, Elastic, Commons Clause): not open source;
  - non-commercial, proprietary and unknown licenses.
- **SPDX expressions:** `A OR B` is allowed when either option is (the user may choose); `A AND B` only when both are.
- **It applies to everything the owner adds:** npm dependencies including development tools, toolbox tools and plugins, and anything proposed by a checkup or the factory.
- **It is enforced, not just written down:**
  - `bun run validate` (and so the pre-push hook and CI) checks every installed package, including nested and scoped ones;
  - the toolbox schema refuses entries with another license;
  - plugins in the toolbox now record their license. The official Anthropic plugins are Apache-2.0, and the factory is MIT.
- **The one exception is Claude Code itself,** the proprietary platform everything runs on. It isn't a dependency or a toolbox entry.
- **Where it's written down:** the rule is in `core.md`, and the `licenses` checkup and the `toolbox` skill refer to it.

## Consequences

- A dependency with another license can't be added unnoticed: the push fails with the package and its license.
- A package that declares its license in an old, non-SPDX form counts as having no license, and is reported, so a human decides.

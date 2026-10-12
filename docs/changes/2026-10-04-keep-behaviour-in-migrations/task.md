---
title: Keep behaviour the same in migrations, and write tests apart from the code
created: 2026-10-04
track: full
classification:
  type: feature
  size: large
  risk: low
  reversible: true
  uncertainty: low
  architectureDebt: []
stages:
  - { name: spec, level: guided, status: done }
  - { name: plan, level: guided, status: done }
  - { name: tasks, level: guided, status: done }
  - { name: build, level: guided, status: done }
  - { name: review, level: guided, status: done }
  - { name: docs, level: guided, status: done }
  - { name: finish, level: guided, status: in-progress }
deviations:
  - "re-triage 2026-10-10: standard to full. The owner added test authorship apart from the code, readable tests, a break-the-code check in the review and comments that say why (AC-9 to AC-14): new concepts across the build, review and testing skills, so large"
  - "intent dropped: the owner stated the problem and chose the approach"
  - "build and review were done for AC-1 to AC-8 (review round 1 fixed in 9ff1860); they run again for the new criteria and task list"
  - "review closed after round 3 (the default limit) with findings 23 to 27 checked by the coordinator, not by a fourth reviewer; the owner chose this on 2026-10-10"
---


# Keep behaviour the same in migrations, and write tests apart from the code

The owner's request: when code moves from one solution to another without meaning to change what it does, a test that passes on the old code must also pass on the new code. A new convention, and the factory's stages enforcing it. Standard track: medium size, low risk, no entry point, so no security review. The spec decides whether the migration plan gets a script check.

Re-triaged on 2026-10-10 after review round 1: the owner folded test authorship and test hardening into this change (AC-9 to AC-14). AC-1 to AC-8 are built and fixed; the new criteria go through spec, plan, tasks, build and review again.

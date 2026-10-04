---
title: Keep behaviour the same during a migration
created: 2026-10-04
track: standard
classification:
  type: feature
  size: medium
  risk: low
  reversible: true
  uncertainty: low
  architectureDebt: []
stages:
  - { name: spec, level: guided, status: in-progress }
  - { name: plan, level: trusted, status: pending }
  - { name: build, level: trusted, status: pending }
  - { name: review, level: trusted, status: pending }
  - { name: finish, level: trusted, status: pending }
deviations: []
---

# Keep behaviour the same during a migration

The owner's request: when code moves from one solution to another without meaning to change what it does, a test that passes on the old code must also pass on the new code. A new convention, and the factory's stages enforcing it. Standard track: medium size, low risk, no entry point, so no security review. The spec decides whether the migration plan gets a script check.

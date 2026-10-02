---
title: Assemble a change's pull request description
created: 2026-10-02
track: standard
classification:
  type: feature
  size: small
  risk: low
  reversible: true
  uncertainty: low
  architectureDebt: []
stages:
  - { name: spec, level: guided, status: done }
  - { name: plan, level: trusted, status: done }
  - { name: build, level: trusted, status: in-progress }
  - { name: security-review, level: trusted, status: pending }
  - { name: review, level: trusted, status: pending }
  - { name: finish, level: trusted, status: pending }
deviations:
  - "standard instead of quick: adds a command, which is an entry point (ADR 0057)"
  - "+ security-review: adds a command, which is an entry point (ADR 0057)"
---

# Assemble a change's pull request description

The finish stage builds a change's pull request description by hand from four documents (ADR 0056). A `pr-body` subcommand of the changes script assembles it instead, so it's complete and the same every time. Small and low-risk, but a new command is an entry point, so the route is standard with a security review (ADR 0057). The first change to go through the factory's full route: what it shows feeds back into the skills.

Written in TypeScript (`plugins/factory/scripts/`), as all plugin scripts; the bundle in `dist/` is generated.

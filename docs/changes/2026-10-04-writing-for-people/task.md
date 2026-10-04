---
title: Write documentation for people
created: 2026-10-04
track: standard
classification:
  type: docs
  size: medium
  risk: low
  reversible: true
  uncertainty: low
  architectureDebt: []
stages:
  - { name: spec, level: guided, status: done }
  - { name: plan, level: trusted, status: done }
  - { name: build, level: trusted, status: done }
  - { name: review, level: trusted, status: done }
  - { name: finish, level: trusted, status: in-progress }
deviations: []
---

# Write documentation for people

The owner's feedback on pull request #14: documentation meant for people is hard to read (long sentences, references in the middle of the text, conclusions at the end). A writing convention fixes that for everything the factory writes for people, and the audience of a document follows from where it lives, instead of a marker per file. No code: skills, conventions, templates and docs. Standard track; no entry point, so no security review.

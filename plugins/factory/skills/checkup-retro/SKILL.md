---
name: checkup-retro
description: Checkup retrospective. Reviews the recent checkup reports for findings that keep coming back, intervals that are too frequent or too rare, feedback about the checkups themselves, and patterns that should become a convention, lint rule or decision. Use for "checkup retro", "review the checkups", or when the checkup runner dispatches it.
metadata:
  intervalDays: 90
  priority: quiet
  task: checkup
---

# Checkup: retro

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

The checkup of the checkups. It turns what the other checkups found into lasting improvements, and tunes the schedule. It proposes; it doesn't change the schedule or the conventions itself.

## In scope

1. **Read** the checkup reports since the previous retro (`docs/checkups/*/`), the reports on unmerged checkup branches (list them yourself with `git branch --list 'checkup/*'`), and the schedule.
2. **Recurring findings**: the same finding in two or more runs without being fixed. For each, propose one of:
   - a fix;
   - a convention, lint rule or test that prevents it;
   - an ADR accepting it ("won't fix", with the reason).
3. **Intervals**:
   - checkups whose last runs found nothing: propose a longer interval;
   - checkups with many high-severity findings: propose a shorter one.
4. **About the checkups**: collect the "About this checkup" feedback from the reports. Propose concrete changes to the checkup skills or the protocol. For the factory plugin's own checkups and protocol, these go to the owner, since the plugin lives in another repository.
5. **Patterns**: the same kind of problem found by different checkups (e.g. missing parsing at several boundaries) points to a missing convention or helper. Propose it.
6. **Coverage**: parts of the project no checkup looks at (see the runner's suggestions).

## Your report

- Under "About this checkup", write about this retro's own instructions. The other checkups' feedback goes under "Needs a human" as concrete proposals.

## Fixes you may make yourself

- None. Everything this checkup finds is a proposal.

## Allowed production access

None.

## Always "Needs a human"

- Every proposal: schedule changes (the runner never changes intervals unasked), new conventions or lint rules, and changes to checkup skills.

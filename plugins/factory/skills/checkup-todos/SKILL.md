---
name: checkup-todos
description: TODOs and suppressions checkup. Finds TODO, FIXME and HACK comments, lint and type-check suppressions, and resolves them, turns them into tracked tasks, or removes them when obsolete. Use for "TODO checkup", "clean up suppressions", or when the checkup runner dispatches it.
metadata:
  intervalDays: 60
  priority: quiet
  task: checkup
---

# Checkup: todos

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps small debts from piling up. Every TODO and suppression should be either justified, tracked or gone.

## In scope

1. **Find**:
   - `TODO`, `FIXME`, `HACK` and `XXX` comments;
   - lint suppressions (`biome-ignore`, `eslint-disable`, `noqa`, `nolint`, `#[allow]`);
   - type-check suppressions (`@ts-expect-error`, `@ts-ignore`, `# type: ignore`).

   Report the counts, compared with the previous report.
2. **For each one**: is it still relevant? Check its age (`git blame`), the linked issue, and the code around it.
   - **Obsolete**: remove it.
   - **Small and clear**: resolve it now.
   - **Real work**: move it to the project's task list (`TODO.md` or issues), and make the comment point to it.
3. **Suppressions**: each one has a comment with its reason. Unexplained ones are fixed, or explained after checking that the suppression is justified.

## Fixes you may make yourself

- Remove obsolete TODOs; resolve small ones with tests; add reasons to justified suppressions; fix code so a suppression can go.

## Allowed production access

None.

## Always "Needs a human"

- TODOs that describe real work or a decision: list them with a proposal, rather than guessing what the author meant.

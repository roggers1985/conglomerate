---
name: factory-review
description: The factory's review and security-review stages. A fresh review agent, not the one that built, checks a change against its spec (every acceptance criterion and its test, which it breaks the code on purpose to see fail), its plan, the conventions and the ADRs, and records findings by severity; findings are fixed or accepted with a reason before the stage is done. The security review does the same with a security focus. Use when a route's review or security-review stage starts, or when the owner asks to review a change.
metadata:
  task: review
---

# Review

The review checks the built change on `change/<name>` before it's finished (ADR 0055). **The reviewer is never the builder:** dispatch a fresh `factory:tasks:review` subagent (Opus, high effort), so it looks with a clean context. The main session coordinates and fixes; the reviewer only reports.

**The reviewer works in its own worktree** (Agent tool, `isolation: "worktree"`, ADR 0042), so it can't switch branches or change files in the coordinator's checkout. Tell it to switch to the change's branch there (`git switch change/<name>`), install dependencies from the lockfile, and run what it needs. It may change code only for the mutation check (below): it **commits nothing and leaves the worktree clean**. It reports, and its worktree is removed afterwards. Tell it that in a worktree Claude Code blocks heredocs and chained shell commands, so it runs one command at a time.

When the reviewer is interrupted (a usage limit, an error), resume that same agent with `SendMessage` instead of starting a new one. To inspect its worktree, use `git -C <worktree> …`; never `cd` into it, which moves your session into the worktree.

## What the reviewer gets

- The change's folder (`docs/changes/<name>/`): `spec.md`, `plan.md`, the task list, `verification.md`, and `intent.md` if there is one.
- The diff: `git diff <default branch>...change/<name>`.
- `CLAUDE.md`, the conventions (`core.md` and the `code-*` skills that apply) and the ADRs.

## What it checks

1. **The spec, criterion by criterion:** the behaviour of every active `AC-<n>` is there, and the evidence in `verification.md` holds. The named test exists, names its criterion, tests what it claims, and passes (run it). A criterion the change doesn't meet is a **high** finding. Then break the code to see that test fail: the mutation check, below.
2. **Nothing beyond the spec:** behaviour the spec doesn't ask for, including anything under "Out of scope", is a finding.
3. **The plan:** the change follows it. Deviations are named and justified; an unjustified one is a finding.
4. **The conventions and ADRs,** in substance: the plan's convention gate said the change follows them, and this is where that's checked. Readability, bounds and fail fast, parsing at the boundary, cancellation, API design, documentation with tested examples, the testing conventions.
5. **The tests:** they test behaviour, not implementation; they cover the edge cases and limits of the spec; nothing is skipped or focused. On the quick track one agent wrote both the tests and the code, so check that the code didn't shape the tests: they follow the spec's words, not the code's structure. An expectation that only restates the implementation is a finding.
6. **Bugs and risks** the tests don't catch: races, unchecked errors, time zones, off-by-one.
7. **The behaviour test, when the route has a migration plan:**
   - it ran on the old code: `verification.md` records the command, the commit and the result. On the quick track there is no change folder: the record is in the build's reply and the pull request's description;
   - the migration didn't change it, in the sense of `code-testing`, "What 'unchanged' means". Diff every file of the test from the commit that added it to the end of the change, recorded outputs included (`git diff <that commit> change/<name> -- <files>`). The migration plan's Behaviour test section names the files. The only changes allowed are the ones `code-testing` allows;
   - when the plan names a data check instead of a test (a schema or data migration), the diff doesn't apply. Check that `verification.md` records the check's result before and after each step.

   A behaviour test changed without a listed reason is a **high** finding: the proof that behaviour stayed the same is gone.
8. **Authentication and authorisation on every entry point** the change adds or touches, in every review, with or without a security-review stage (ADR 0057). An entry point without a check is a **high** finding, unless the spec's Security section marks it as public and says why. "Not yet" in the spec doesn't make it public: it's still a high finding, which only the owner can accept, with a tracked task to add the check.

   **A known gap is accepted once, not on every change.** In an existing application, old entry points without checks are recorded in the architecture register's debt table (`docs/architecture/`), with the owner's acceptance, the entry points it covers, and an expiry date (12 months, ADR 0046). While that entry is valid, a finding on one of those entry points is closed as `accepted by owner: see the architecture register, debt #<n>`. A new entry point, or an expired entry, is a new high finding.

**Severity:**
- **high:** a criterion isn't met, a bug, a security hole, data loss, or a broken convention with real consequences;
- **medium:** a convention not followed, a missing test for an edge case, an unjustified deviation;
- **low:** naming, wording, small readability points.

## The mutation check

A passing test proves little until it has been seen to fail. So for each criterion whose evidence is a test, the reviewer breaks the code on purpose:

1. Make the smallest change in the production code that breaks what the criterion states, such as inverting a condition, removing a guard, moving a limit by one or skipping an error path.
2. Run the criterion's test, and see it fail.
3. Restore the code before the next break.

Every error path and limit of the criterion gets its own break. A criterion that only changes skill or document text may be skipped, with the reason recorded.

This happens in the reviewer's own worktree, which is thrown away after the review. The reviewer commits nothing and restores every break, so the worktree ends clean (`git -C <worktree> status` shows nothing).

Record each break in the review's `## Mutation checks` table: the criterion, the test, what was broken, and the result. The result is `failed`, `stayed green: finding <n>`, or `skipped: <why>`.

**A test that stays green is a finding** in the findings table:
- **high** when the break hits what the criterion states: the criterion then has no evidence that holds;
- **medium** when it hits an edge case or limit around the criterion, like a missing edge-case test.

## The security-review stage

Triage adds it for authentication, secrets or untrusted input. The same reviewer setup, focused on:
- how the change handles authentication and authorisation;
- input parsing at every entry point (`code-parsing`);
- secrets;
- injection and unsafe rendering;
- dependencies it adds;
- prompt injection where model output is used.

Write the findings to `security-review.md`. Every security hole is **high**.

## The review document

`review.md` (or `security-review.md`), next to `task.md`:

```markdown
# Review: <title>

## Summary

Two or three sentences. Start with the verdict: does the change do what the spec says? Then say what matters most.

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | high | AC-3 isn't met. A failed export leaves the button disabled. | `src/export/button.tsx:42` | fixed |
| 2 | low | The name `data` doesn't say what it holds. | `src/export/csv.ts:10` | accepted: it's the term the API uses |
| 3 | medium | The test of AC-5 stays green when the row limit moves by one. | `src/export/csv.test.ts:30` | fixed |

## Mutation checks

| Criterion | Test | What was broken | Result |
| --------- | ---- | --------------- | ------ |
| AC-3 | `button.test.tsx` › "AC-3: enables the button again after a failed export" | Removed the `finally` that enables the button. | failed |
| AC-5 | `csv.test.ts` › "AC-5: refuses more than 10,000 rows" | Moved the limit from 10,000 to 10,001. | stayed green: finding 3 |
```

With no findings, write "None." under Findings. With no criterion that has a test, write "None." under Mutation checks.

## Closing the findings

The reviewer writes every finding as `open`. Then, in the main session:

- **Fix** a finding as a task, the way the build does (`factory-build`: the test agent first, then the code agent, each in its own worktree). Then ask the reviewer to check the fix, and set the finding to `fixed`.
- **A test that stayed green** is fixed by the test agent, which strengthens the test. The proof is that the stronger test fails on the break recorded under Mutation checks and passes on the code. A code agent follows only when the stronger test fails on the code too.
- **Accept** a finding instead of fixing it only with a reason, as `accepted: <reason>`. At `guided`, only the owner accepts. At `trusted` and `autonomous`, you may accept medium and low findings, and list them for the owner.
- **A high finding** is fixed, or accepted by the owner (`accepted by owner: <reason>`), at every autonomy level.

**At most `reviewRounds` review rounds** (the "Factory settings" section of the session context; 3 by default, ADR 0058). A round is: the reviewer reports, the findings are fixed, the reviewer checks the fixes. When findings are still open after the last round, stop: put them to the owner with what was tried, instead of another round. A reviewer and a fixer that keep disagreeing need a decision, not more attempts.

When every finding is closed, set the stage to `done`, and run `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check docs/changes/<name>/task.md`. It refuses a done review that:
- is missing its summary or findings;
- has findings outside the table (anything under Findings must be the table, or "None.");
- has a finding that is still open, has an unknown severity, or is accepted without a reason;
- has a high finding accepted by anyone but the owner.

Fix what it reports, then commit.

When the review shows the change doesn't fit its plan or spec at all, stop and re-triage (see `factory-triage`) instead of patching it.

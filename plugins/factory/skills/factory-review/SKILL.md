---
name: factory-review
description: The factory's review and security-review stages. A fresh review agent, not the one that built, checks a change against its spec (every acceptance criterion and its test), its plan, the conventions and the ADRs, and records findings by severity; findings are fixed or accepted with a reason before the stage is done. The security review does the same with a security focus. Use when a route's review or security-review stage starts, or when the owner asks to review a change.
metadata:
  task: review
---

# Review

The review checks the built change on `change/<name>` before it's finished (ADR 0055). **The reviewer is never the builder:** dispatch a fresh `factory:tasks:review` subagent (Opus, high effort), so it looks with a clean context. The main session coordinates and fixes; the reviewer only reports.

**The reviewer works in its own worktree** (Agent tool, `isolation: "worktree"`, ADR 0042), so it can't switch branches or change files in the coordinator's checkout. Tell it to switch to the change's branch there (`git switch change/<name>`), install dependencies from the lockfile, run what it needs, and change nothing: it reports, and its worktree is removed afterwards.

## What the reviewer gets

- The change's folder (`docs/changes/<name>/`): `spec.md`, `plan.md`, the task list, `verification.md`, and `intent.md` if there is one.
- The diff: `git diff <default branch>...change/<name>`.
- `CLAUDE.md`, the conventions (`core.md` and the `code-*` skills that apply) and the ADRs.

## What it checks

1. **The spec, criterion by criterion:** the behaviour of every active `AC-<n>` is there, and the evidence in `verification.md` holds. The named test exists, names its criterion, tests what it claims, and passes (run it). A criterion the change doesn't meet is a **high** finding.
2. **Nothing beyond the spec:** behaviour the spec doesn't ask for, including anything under "Out of scope", is a finding.
3. **The plan:** the change follows it. Deviations are named and justified; an unjustified one is a finding.
4. **The conventions and ADRs,** in substance: the plan's convention gate said the change follows them, and this is where that's checked. Readability, bounds and fail fast, parsing at the boundary, cancellation, API design, documentation with tested examples, the testing conventions.
5. **The tests:** they test behaviour, not implementation; they cover the edge cases and limits of the spec; nothing is skipped or focused.
6. **Bugs and risks** the tests don't catch: races, unchecked errors, time zones, off-by-one.
7. **Authentication and authorisation on every entry point** the change adds or touches, in every review, with or without a security-review stage (ADR 0057). An entry point without a check is a **high** finding, unless the spec's Security section marks it as public and says why. "Not yet" in the spec doesn't make it public: it's still a high finding, which only the owner can accept, with a tracked task to add the check.

   **A known gap is accepted once, not on every change.** In an existing application, old entry points without checks are recorded in the architecture register's debt table (`docs/architecture/`), with the owner's acceptance, the entry points it covers, and an expiry date (12 months, ADR 0046). While that entry is valid, a finding on one of those entry points is closed as `accepted by owner: see the architecture register, debt #<n>`. A new entry point, or an expired entry, is a new high finding.

**Severity:**
- **high:** a criterion isn't met, a bug, a security hole, data loss, or a broken convention with real consequences;
- **medium:** a convention not followed, a missing test for an edge case, an unjustified deviation;
- **low:** naming, wording, small readability points.

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

Two or three sentences: does the change do what the spec says, and what matters most.

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | high | AC-3 isn't met: a failed export leaves the button disabled | `src/export/button.tsx:42` | fixed |
| 2 | low | `data` could say what it holds | `src/export/csv.ts:10` | accepted: matches the API's term |
```

With no findings, write "None." under Findings.

## Closing the findings

The reviewer writes every finding as `open`. Then, in the main session:

- **Fix** a finding as a task, the way the build does (`factory-build`: a fresh subagent, test-first, in a worktree). Then ask the reviewer to check the fix, and set the finding to `fixed`.
- **Accept** a finding instead of fixing it only with a reason, as `accepted: <reason>`. At `guided`, only the owner accepts. At `trusted` and `autonomous`, you may accept medium and low findings, and list them for the owner.
- **A high finding** is fixed, or accepted by the owner (`accepted by owner: <reason>`), at every autonomy level.

**At most 3 review rounds** (a round is: the reviewer reports, the findings are fixed, the reviewer checks the fixes). When findings are still open after the third round, stop: put them to the owner with what was tried, instead of another round. A reviewer and a fixer that keep disagreeing need a decision, not more attempts.

When every finding is closed, set the stage to `done`, and run `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check docs/changes/<name>/task.md`. It refuses a done review that:
- is missing its summary or findings;
- has findings outside the table (anything under Findings must be the table, or "None.");
- has a finding that is still open, has an unknown severity, or is accepted without a reason;
- has a high finding accepted by anyone but the owner.

Fix what it reports, then commit.

When the review shows the change doesn't fit its plan or spec at all, stop and re-triage (see `factory-triage`) instead of patching it.

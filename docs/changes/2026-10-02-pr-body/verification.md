# Verification: Assemble a change's pull request description

## Checks

- `bun run check` on `change/2026-10-02-pr-body` after the last review fixes: passed (typecheck, lint, 423 tests, 94 doctest examples, validate including the regenerated bundles).
- Each task's Verify command, run by its builder before committing: T-1 58 tests, T-2 23 tests (plus a mutation check: every safeguard removed in turn made a test fail), T-3 18 tests, T-4 38 tests, T-5 lint and validate. The security and review fixes each ran their own tests, typecheck, lint and doctest before their merge, and the full suite after it.
- Ran the bundled command on this change itself while its build was in progress: `bun plugins/factory/dist/changes.js pr-body docs/changes/2026-10-02-pr-body` refused with "✗ not ready for a pull request: build (in-progress), security-review (pending), review (pending) before finish", exit code 1, nothing on standard output. The reviewer ran it again on a copy of the change after marking its review done, and it printed a correct description.

## Evidence

- AC-1: `changes.test.ts` › "AC-1: prints the route, each criterion with its evidence, the review summary and the added decision", and "AC-1: compares with the branch given by --base"
- AC-2: `pr-body.test.ts` › "AC-2: lists the track, every stage with its status, in order", "AC-2: lists the deviations with their reasons, or says None.", "AC-2: shows a skipped stage as skipped"
- AC-3: `pr-body.test.ts` › "AC-3: lists every active criterion with its text and evidence", "AC-3: doesn't list a dropped criterion, but says how many were dropped", "AC-3: says when a criterion has no evidence"; `stage-gates.test.ts` › "AC-3: lists each criterion's text, in order", "AC-3: maps each criterion to its evidence text"
- AC-4: `pr-body.test.ts` › "AC-4: includes the review's summary and the security review's summary", "AC-4: lists accepted findings from both reviews with severity, finding, where and reason", "AC-4: says every finding was fixed when none was accepted", "AC-4: says there were no findings when both reviews have none", "AC-4: leaves out a skipped security review's document, even with an open finding", "AC-4: leaves out a skipped review's document", "AC-4: lists a finding with an unexpected status instead of counting it as fixed"
- AC-5: `decision-records.test.ts` › "AC-5: lists the records added on the branch, sorted, with their titles, marking the Proposed ones"; `pr-body.test.ts` › "AC-5: lists the decision records, marking the Proposed ones"
- AC-6: `changes.test.ts` › "AC-6: refuses while a stage before finish is pending, naming it, and prints nothing", "AC-6: refuses while a stage before finish is in progress, naming it"; and the run on this change itself, under Checks
- AC-7: `changes.test.ts` › "AC-7: refuses a done stage whose document fails its gate, with the gate's problem"
- AC-8: `pr-body.test.ts` › "AC-8: renders a body of exactly the maximum length, and refuses one character more"; `changes.test.ts` › "AC-8: refuses a description over GitHub's limit with its length and the limit, and prints nothing"
- AC-9: `pr-body.test.ts` › "AC-9: renders the same body twice for the same input"; and `decision-records.test.ts` › "AC-5: lists the records added on the branch, sorted, with their titles, marking the Proposed ones", which keeps the git part's order stable

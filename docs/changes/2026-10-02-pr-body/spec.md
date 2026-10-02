# Spec: Assemble a change's pull request description

## Problem

The finish stage builds a change's pull request description by hand from four documents: the route in `task.md`, the criteria in `spec.md` with their evidence in `verification.md`, the review in `review.md`, and the decision records the change added (ADR 0056). By hand, a part gets left out or worded differently each time, and the description is exactly what the owner reads before merging.

## Current behaviour

`plugins/factory/scripts/changes.ts` has three subcommands: `check` (validates a change's `task.md` and the gates of its done stages), `status` (lists unfinished changes) and `reminder` (the session-start hook). The gates in `stage-gates.ts` already parse each document's sections, the criteria ids, the evidence and the review findings. The `factory-finish` skill tells Claude to assemble the description by hand. Nothing produces it.

## Acceptance criteria

- **AC-1**: WHEN the owner runs `changes pr-body <change folder>`, THE SYSTEM SHALL print the change's pull request description, in Markdown, to standard output.
- **AC-2**: THE SYSTEM SHALL include the route: the track, every stage with its status, and every recorded deviation with its reason.
- **AC-3**: THE SYSTEM SHALL list every active acceptance criterion of `spec.md`, with its text and its evidence from `verification.md`.
- **AC-4**: THE SYSTEM SHALL include the summary of `review.md`, and of `security-review.md` WHEN the route has a security review, together with every finding that was accepted instead of fixed, with its reason.
- **AC-5**: THE SYSTEM SHALL list the decision records added on the change's branch compared with the base branch, marking those whose status is Proposed.
- **AC-6**: IF a stage before `finish` is pending or in progress, THEN THE SYSTEM SHALL refuse with a message that names that stage, and print nothing to standard output.
- **AC-7**: IF the change's documents don't pass their stages' gates, THEN THE SYSTEM SHALL refuse with the problems the gates report.
- **AC-8**: IF the description is longer than 65,536 characters, GitHub's limit for a pull request body, THEN THE SYSTEM SHALL refuse with the length and the limit, instead of truncating it.
- **AC-9**: THE SYSTEM SHALL produce the same description every time for the same documents and branch.

## Edge cases

- **Dropped criteria** aren't listed as criteria; the description says how many were dropped, so the reviewer knows they exist.
- **No findings** ("None." in the review): the review part says there were none.
- **No accepted findings** (all fixed): the description says every finding was fixed.
- **No new decision records:** the description says so, instead of leaving the part out.
- **A skipped stage** (e.g. no security review on the route): its part is left out, and the route shows it as skipped.
- **A folder that isn't a change** (no `task.md`): refused, naming the folder (AC-7).
- **A base branch that doesn't exist:** refused with the branch name, before anything is printed.
- **Cancelled** (Ctrl-C): stops without printing a partial description.

## Limits

- The description: at most 65,536 characters (AC-8).
- The documents: read with the existing limit of 1 MiB each.
- Decision records listed: at most 100 per change; more is refused (a change with that many decisions should be split).
- The base branch: `main` by default, or the branch given with `--base <branch>`.

## Security

- Authentication: Public, because it's a local developer command, run by whoever has the repository checked out, the same people who can read the documents directly.
- Authorisation: none beyond file-system access: it only reads the change's documents and the decision records, and changes nothing.
- Untrusted input: the folder argument, the base branch argument (passed to git as a single argument, never through a shell), and the documents' contents, which are copied into the description as text and never executed.
- Sensitive data: none beyond what the repository's documents already contain; the description goes to standard output only.

## Out of scope

- Opening the pull request: the finish stage does that with `gh`, using this description.
- The pull request's title, and the attribution line that Claude adds when it opens a pull request.
- The quick track, which has no change folder: its description stays in the reply, as the build skill says.

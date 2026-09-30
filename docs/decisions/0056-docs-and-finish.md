# 56. Docs and finish

Date: 2026-09-30

## Status

Accepted

Extends [ADR-0055](0055-review-and-security-review.md), and completes the factory's stages (ADR 0051 to 0055).

## Context

The last item among the factory's stages in `TODO.md` was a fixed ending for a branch: merge, pull request or discard, with cleanup. The full track also has a *docs* stage. The owner asked for the remaining stages to be built on their own, each as a pull request to review together. They also said how they want changes merged: after reviewing them together.

## Decision

- **One skill, `factory-finish`,** for the docs and finish stages.
- **Docs:** the change brings the documentation it touched up to date:
  - `README.md` and `CLAUDE.md`;
  - an ADR for every decision, *Proposed* when Claude made it alone at `autonomous`;
  - the glossary;
  - the architecture register's workaround log;
  - comments in the changed files.

  On the full track this is its own stage; elsewhere it's the first step of finishing.
- **How a branch ends depends on the autonomy level:**
  - at `guided` and `trusted`: a pull request, and the owner merges (without a remote, the branch waits for the owner);
  - at `autonomous`: Claude merges its own work once the checks pass and the review has no open findings.
- **Discarding a change is always the owner's decision,** because it deletes unmerged work (`core.md`).
- **The pull request's description is built from the change's documents:**
  - the route and its deviations;
  - each criterion with its evidence;
  - the review summary, with any accepted findings;
  - the ADRs, marking those that are Proposed.
- **Cleanup:**
  - leftover worktrees and task branches are removed;
  - after the merge, the change branch goes, locally and remotely;
  - *finish* is set to done, so the change drops out of the session-start report.
- **No new script:** the route check already refuses *finish* as done while an earlier stage is pending (ADR 0051).

## Consequences

- The factory's stages are complete in a first form: triage, intake, planning, build, review and finish, with script gates between them.
- Every finished change leaves a record: its folder in `docs/changes/`, and a pull request whose description tells its story.
- The stages have not yet been used on a real change. The first real change is their real test, and what it shows should feed back into the skills and ADRs.

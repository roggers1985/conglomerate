# 43. Checkup branches as pull requests

Date: 2026-09-30

## Status

Accepted

Amends [ADR-0010](0010-recurring-checkups.md) (handing over a checkup).

## Context

The checkup protocol already said to push a checkup's branch and open a pull request when the repository has a GitHub remote. In this repository that wasn't possible at first: the remote is private, and the `gh` CLI wasn't installed. So the question stayed open in `TODO.md`, and checkups left their branches local. `gh` is now installed and logged in, and the owner wants work pushed regularly.

## Decision

- **Checkups push their branch and open a pull request** titled `Checkup: <name> (<date>)` whenever the repository has a GitHub remote. The owner reviews and merges it on GitHub.
- **Without a working `gh`,** the checkup still pushes its branch and says the pull request has to be opened by hand. Without a remote, the branch stays local, as before.
- **After merging on GitHub,** the default branch has to be pulled before the report counts: the runner computes the status from local files. The runner pulls with `--ff-only` when PRs were merged since the last run, and deletes the local branches of merged checkups.
- **`main` is pushed after every commit that passed the checks,** through the pre-push hook (ADR 0006).

## Consequences

- Checkups are reviewed on GitHub, with the report as the PR description, and GitHub keeps a record of each run.
- Merging a checkup is no longer done by Claude in the session but by the owner on GitHub, unless the owner asks for a local merge.
- A checkup whose PR is merged still shows as due until the default branch is pulled. The runner's pull step covers this.

---
name: factory-finish
description: The factory's docs and finish stages. Brings the documentation up to date with a change (README, CLAUDE.md, ADRs, glossary, the architecture register), then ends the change's branch in a fixed way - a pull request, a merge, or (only on the owner's word) discarding it - and cleans up worktrees and branches. Use when a route's docs or finish stage starts, or when the owner asks to wrap up a change.
metadata:
  task: code
---

# Finish

The last stages of a route: make sure the documentation tells the truth, then end the change's branch `change/<name>` in one of a few fixed ways, and leave nothing behind (ADR 0056).

## The docs stage

On the full track this is its own stage; on the others, do it as the first step of finishing. For what the change touched:

- **`README.md` and `CLAUDE.md`:** commands, paths, setup and behaviour that changed.
- **Decisions:** every decision the change made has an ADR. At `autonomous`, one Claude made alone has status *Proposed* (ADR 0044); list those for the owner.
- **The glossary,** for new concepts, where the project has one.
- **The architecture register** (`docs/architecture/`): a workaround the change needed goes in its workaround log (`core.md`).
- **Code comments and doc comments** in the changed files still match what the code does.

Commit the docs on the change's branch.

## Finishing the branch

First check that the route is ready: every stage before *finish* is `done` or `skipped`. The route check (`changes.js check`) refuses *finish* as done while an earlier stage is still pending. Then end the branch according to the autonomy level:

| | With a remote (e.g. GitHub) | Without a remote |
|---|---|---|
| `guided`, `trusted` | Push `change/<name>` and open a pull request. **The owner merges.** | Leave the branch for the owner to merge. |
| `autonomous` | Push, open the pull request, and merge it yourself once its checks pass and the review has no open findings (ADR 0055). | Merge into the default branch, run the checks there, and push if there's a remote later. |

**Discarding** a change deletes unmerged work, so it's the owner's at every level (`core.md`). Only on their word:
- if the change has a pull request, close it with the reason as a comment, so the record stays on GitHub;
- delete the branch and its task branches;
- without a pull request, the change folder existed only on the deleted branch: tell the owner that nothing of it is kept.

### The pull request

Title it after the change. Build its description with the command `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" pr-body docs/changes/<name>` (add `--base <branch>` when the default branch isn't `main`). The command refuses while a stage before *finish* isn't done, or a document fails its gate—fix what it reports instead of writing the description by hand. It produces:

- the route (the track, the stages, and the deviations with their reasons);
- the acceptance criteria from `spec.md`, each with its evidence from `verification.md`;
- the review's summary, and any findings that were accepted rather than fixed, with their reasons;
- the ADRs the change added, marking those that are *Proposed*.

Pass its output to `gh pr create --body-file -` (or a temporary file), and add the attribution line Claude uses for pull requests at the end (ADR 0056).

## Cleaning up

- Remove any leftover worktrees and task branches of the change (`git worktree list`, `git branch --list 'change/<name>--*'`).
- After the merge: delete `change/<name>`, locally and on the remote, and pull the default branch.
- **When *finish* is done:** set it to `in-progress` in `task.md` before you open the pull request, and commit that with the change. At session start, the change then shows as waiting at *finish*, which means waiting for the merge. After the merge (yours at `autonomous`, the owner's otherwise), pull the default branch, set *finish* to `done` in a small commit there, and push it. The change then drops out of the unfinished changes reported at session start.

## Afterwards

- If the change finished a milestone of the project itself, update what tracks it. In the factory's own repository, that's `docs/readiness.md`.
- Anything left over (a follow-up, an accepted finding worth revisiting) becomes a tracked task, never an untracked note (`core.md`: no untracked debt).

# 28. Continuous integration

Date: 2026-09-29

## Status

Accepted

Completes [ADR-0006](0006-pre-push-quality-gate.md), which expected CI "once we have CI".

## Context

All quality gates ran only in the local pre-push hook, which `git push --no-verify` bypasses. The first `repo-health` checkup reported the missing CI. The repository now has a private GitHub remote.

## Decision

- **Workflow:** `.github/workflows/check.yml` runs `bun install --frozen-lockfile` and `bun run check` on every push to `main` and on every pull request. That is the same gate as the pre-push hook.
- **Hardening:**
  - third-party actions are pinned to a full commit SHA, with the version in a comment;
  - the workflow's token is read-only;
  - a newer run cancels an older one for the same branch.
- **One Bun version:** it is declared once, as `"packageManager": "bun@1.4.2"` in `package.json`. CI reads it from there, so local and CI runs use the same version. The `outdated-packages` checkup keeps it current.

## Consequences

- A bypassed hook or a broken merge is caught on GitHub.
- Updating the pinned actions is a deliberate step, done by the `repo-health` and `outdated-packages` checkups.

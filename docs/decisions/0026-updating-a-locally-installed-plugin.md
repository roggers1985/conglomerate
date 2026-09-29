# 26. Updating a locally installed plugin

Date: 2026-09-29

## Status

Accepted

Supersedes the update procedure in [ADR-0024](0024-local-marketplace-installation.md).

## Context

ADR-0024 described updating the installed plugin with `claude plugin marketplace update` and `claude plugin update`, and left open whether `version` had to be raised. The `claude-code-platform` checkup found the answer in the Claude Code documentation ("Versions and updates"). A plugin with a relative path inside a marketplace added from a *local folder* is loaded in place, from its source files, at every session start or `/reload-plugins`, whatever its `version`.

## Decision

- **To update:** after changing the plugin, run `bun run check`, commit, and start a new session (or run `/reload-plugins`). The `claude plugin … update` commands are not needed for this installation, and `version` doesn't have to change for updates to arrive.
- **Uncommitted changes load too:** the plugin is loaded from the working folder, so uncommitted changes load into new sessions as well. Commit before relying on a change in other projects.

## Consequences

- A change takes effect in every project's next session, as soon as it is in the working folder.
- A broken working copy breaks the plugin everywhere, which is one more reason for the pre-commit and pre-push checks.

# 60. Reading files a branch controls

Date: 2026-10-02

## Status

Accepted

Extends [ADR-0032](0032-upper-bounds-on-everything.md) (bounds on file reads) and [ADR-0056](0056-docs-and-finish.md) (the pull request description is assembled by a script). Comes from the security review of the `pr-body` change (`docs/changes/2026-10-02-pr-body/`).

## Context

The `pr-body` command copies text from a change's documents and decision records into a pull request description. Its security review showed that a branch could make it read files outside the repository: through a committed symbolic link to a file, to a whole change folder, or to `docs/changes`. A FIFO or `/dev/zero` could also hang a read or get past the size limit. The fixes changed `lib/files.ts` and every place that reads files. These are decisions, so they're recorded here.

## Decision

- **`readText` and `readJson` refuse anything that isn't a regular file** (a FIFO, a device, a socket or a folder) before opening it, so no read can hang or run past its size limit.
- **Every read chooses explicitly whether to follow symbolic links:** `symbolicLinks: "follow" | "refuse"` is required, with no default. Following a link is the risky behaviour, so it's never implicit (`code-api-design`).
  - **`"refuse"` for content a branch or a cloned project controls:** a change's documents, the project's checkup schedule, the project's `.claude/factory.json` and other project settings. A refused link fails atomically, by opening with `O_NOFOLLOW`.
  - **`"follow"`** for the plugin's own files, the repository's tooling, `node_modules`, and the user's own settings in their home folder.
- **Decision records that a change adds are read from git,** by blob, and only when git records them as regular files. They're never read from the working tree.
- **A change folder must be a real folder at `<project>/docs/changes/<name>`.** `check` and `pr-body` refuse a change folder, `docs/changes` or `docs` that is a link leading elsewhere. Reaching the project itself through a link stays allowed.
- **The pull request description is assembled by `changes.js pr-body`** from the change's documents, instead of by hand. That extends ADR 0056, which said the finish stage needed no new script.

## Consequences

- Every place that reads files shows its choice, so a review can see at a glance which reads trust their input.
- A project can't use symbolic links in its change folders or settings. That's intended, and every documented use already works without them.
- A residual risk is left open and tracked in `TODO.md`: `changes status` and the session-start reminder still follow a committed `docs/changes` link. Only titles can appear in the session context that way, never in a pull request.

# Security review: Assemble a change's pull request description

## Summary

The new `pr-body` entry point fits its "Public, local developer command" answer: it only reads files. It runs `git rev-parse` and `git diff` as argument lists with no shell, and both are read-only. `--base` can't be injected as an option, git's output and run time are bounded, cancellation works, the `GIT_DIR` filter matches `git rev-parse --local-env-vars`, and no dependencies were added. The weak spots are on the file side: decision records are read from the working tree, following symlinks and without a regular-file check, and the project folder comes from the current directory instead of the change folder.

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | medium | Added decision records are read from the working tree with symlinks followed and no regular-file check: a committed symlink makes `pr-body` read any file the user can read and put its first heading into the description; a symlink to `/dev/zero` gets past the 1 MiB limit; one to a FIFO hangs in `open()`, which the signal can't cancel. The change-folder documents use the same `readText` path. | `plugins/factory/scripts/decision-records.ts:194`, `lib/files.ts:66` | open |
| 2 | medium | The repository whose decision records are listed comes from `CLAUDE_PROJECT_DIR` or the current directory, not from the change folder: run from a subfolder, the description silently says "No new decision records."; run with another repository's change, it lists the wrong repository's records. | `plugins/factory/scripts/changes.ts:568` | open |
| 3 | low | The documents' text is copied verbatim into a body GitHub interprets: closing keywords close issues, `@name` notifies people, an unclosed `<!--` hides the rest of the description, and a file name with a newline or backtick breaks the list. | `plugins/factory/scripts/pr-body.ts:120`, `pr-body.ts:180`, `pr-body.ts:188` | open |
| 4 | low | `HEADING` is quadratic on a line that starts with `## ` and has a long run of spaces before a non-space: 40,000 spaces take 0.9 s, a 1 MiB line minutes. Every document `pr-body` reads goes through it. | `plugins/factory/scripts/stage-gates.ts:30` | open |

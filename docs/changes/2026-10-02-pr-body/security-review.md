# Security review: Assemble a change's pull request description

## Summary

Round 2: the four round-1 findings are closed. Decision records are read from git with mode checks, `readText` refuses anything that isn't a regular file, a change document that is a symbolic link is refused, the project folder comes from the change folder, `<!--` and unsafe file names are neutralised, `HEADING` is linear, and `git diff` passes `--no-ext-diff --no-textconv --end-of-options`. Three new findings are open: a symbolic link to a whole change folder (or `docs/changes`) still pulls in documents from outside the repository, the quadratic pattern of finding 4 exists in four more regexes, and several refusals end as uncaught exceptions, so at session start one unreadable document hides every change.

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | medium | Added decision records were read from the working tree with symlinks followed and no regular-file check (a committed symlink leaked any readable file's heading; `/dev/zero` got past the limit; a FIFO hung). | `plugins/factory/scripts/decision-records.ts`, `lib/files.ts` | fixed |
| 2 | medium | The repository whose decision records are listed came from the current directory instead of the change folder. | `plugins/factory/scripts/changes.ts` | fixed |
| 3 | low | The documents' text is copied verbatim into a body GitHub interprets: closing keywords, `@mentions`, an unclosed `<!--`, file names with a newline or backtick. | `plugins/factory/scripts/pr-body.ts` | accepted: `<!--` and unsafe file names are neutralised; closing keywords and `@mentions` are kept on purpose, because the documents are the repository's own, reviewed in the same pull request, a closing keyword can be intended, and the owner reads the description before the pull request is opened |
| 4 | low | `HEADING` was quadratic on a `## ` line with a long run of spaces. | `plugins/factory/scripts/stage-gates.ts` | fixed |
| 5 | medium | The symlink check only looks at the last part of each document's path: a committed `docs/changes/<name>` (or `docs/changes`, or `docs`) that links to a folder outside the repository is followed, and its documents end up in the description. The `lstat` check and the read are two steps, so the check isn't atomic. | `plugins/factory/scripts/changes.ts:403-418`, `changes.ts:597-604` | open |
| 6 | low | `SECURITY_ANSWER`, `EVIDENCE`, `TASK_HEADING` and `TASK_FIELD` have the quadratic pattern of finding 4 (`:\s*(.*)$` on a long whitespace run ending in `\r`): a 1 MiB line takes about 10 minutes. | `plugins/factory/scripts/stage-gates.ts:27`, `:208`, `:209`, `:454` | open |
| 7 | low | Refusals added by the fixes end the process as an uncaught exception (a stack trace and minified bundle source on stderr) instead of a `✗` line; in `status` and `reminder`, one unreadable change document makes the whole listing fail. | `plugins/factory/scripts/changes.ts:622`, `changes.ts:522-537`, `decision-records.ts:155` | open |

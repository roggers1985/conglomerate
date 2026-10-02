# Review: Assemble a change's pull request description

## Summary

Round 2: nine of the ten round-1 findings are closed: a skipped review is no longer rendered, any finding that is neither fixed nor accepted is listed, the documents rendered are the ones that passed the gate, `<!--` is broken without showing an entity, and branch-controlled files refuse symbolic links. Finding 4 stays open on purpose until the counts are final. The fixes introduced one medium finding (a symlinked project checkup skill crashes `checkups status` and the session-start reminder) and three low ones (the link rule described more broadly than applied, a stale doc comment, and the Ctrl-C test's cleanup on failure).

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | medium | A review document whose stage is skipped is still rendered, and `findingsText` counts every finding that isn't accepted as fixed, so an open finding in a stale `security-review.md` comes out as "Every finding was fixed." | `plugins/factory/scripts/pr-body.ts:138-139`, `:179` | fixed |
| 2 | medium | Every existing file read passes `symbolicLinks: "follow"`, including files committed in a project (`docs/checkups/checkups.json`, `.claude/factory.json`, project settings), while `readText`'s own rule says branch-controlled content is read with `"refuse"`. | `plugins/factory/scripts/checkups.ts:578`, `settings.ts:205`, `toolbox.ts:242`; rule at `lib/files.ts:75` | fixed |
| 3 | medium | The decisions from the security fixes aren't recorded: required link choice for file reads, `"refuse"` for branch-controlled content, change folders as real folders under `docs/changes`. CLAUDE.md still names only `maxBytes`/`maxEntries`, and ADR 0056 still says "No new script". | `CLAUDE.md:26`, `docs/decisions/0056-docs-and-finish.md:39` | fixed |
| 4 | low | `verification.md` and `plan.md` lag behind the code: old test counts, the AC-1 test name, AC-9's evidence only covers the renderer, and the plan doesn't name the deviations that came with the security fixes. | `docs/changes/2026-10-02-pr-body/verification.md`, `plan.md` | open |
| 5 | low | Three tests of `evidence()` are labelled AC-4, but `evidence()` serves AC-3. | `plugins/factory/scripts/stage-gates.test.ts:537`, `:551`, `:555` | fixed |
| 6 | low | `buildPrBody` gates the documents in `readChange` and then reads them again to render them, so what's rendered isn't necessarily what passed the gate. | `plugins/factory/scripts/changes.ts:686`, `:701-716` | fixed |
| 7 | low | `<!--` is replaced with `&lt;!--` everywhere, including inside code spans, where GitHub shows `&lt;!--` literally. | `plugins/factory/scripts/pr-body.ts:97` | fixed |
| 8 | low | Command-level behaviour without a test: AC-8's refusal at the command, `--base` given twice, an extra argument, and the Ctrl-C edge case. | `plugins/factory/scripts/changes.test.ts` | fixed |
| 9 | low | The length is measured in UTF-16 code units (`body.length`) but documented as "characters". | `plugins/factory/scripts/pr-body.ts:13`, `:99` | fixed |
| 10 | low | Test hygiene: the case-insensitivity test returns early (a hidden skip), `lib/files.test.ts` still says "by default", and `decision-records.test.ts` shares one 30 s timeout signal across all tests. | `plugins/factory/scripts/changes.test.ts:867`, `lib/files.test.ts:101`, `plugins/factory/scripts/decision-records.test.ts:40` | fixed |
| 11 | medium | A project checkup skill whose `SKILL.md` is a symbolic link is read with `"refuse"`, but `readSkillDefaults` only catches a missing file, so the `SymbolicLinkError` crashes `checkups status` and the session-start reminder with a stack trace, while a symlinked schedule or settings file is reported as invalid. | `plugins/factory/scripts/checkups.ts:592-598`, `:622-628`, `:667-670` | open |
| 12 | low | ADR 0060 and CLAUDE.md describe the link rule more broadly than the code applies it: only the last part of a path is checked, `readDir` has no link choice, and `doctest.ts` reads a project's sources with `"follow"` without being named as an exception. | `docs/decisions/0060-reading-files-a-branch-controls.md`, `CLAUDE.md:26`, `plugins/factory/scripts/doctest.ts:303` | open |
| 13 | low | `reviewSection`'s doc comment still says "`null` when neither review is recorded or on the route"; only the route counts now. | `plugins/factory/scripts/pr-body.ts:143` | open |
| 14 | low | The Ctrl-C test doesn't kill the spawned CLI when an assertion fails before `cli.kill`, so a failed run can leave a `bun` process and its stand-in `sleep 30` running. | `plugins/factory/scripts/changes.test.ts:723-748` | open |


# Review: Assemble a change's pull request description

## Summary

Round 3 (the last): every round-2 finding is closed. `verification.md` names each test exactly and its counts match a fresh `bun run check` (423 tests, 94 doctest examples); a symbolic-link checkup skill is reported as invalid and doesn't fall back to the plugin's defaults; ADR 0060 describes the link rule as the code applies it. The fixes introduced only low findings: a misleading heading for an invalid checkup skill, an inconsistent message for a linked `.claude/factory.json`, a Ctrl-C test cleanup that doesn't reach the stand-in git, and small documentation gaps.

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | medium | A review document whose stage is skipped is still rendered, and `findingsText` counts every finding that isn't accepted as fixed, so an open finding in a stale `security-review.md` comes out as "Every finding was fixed." | `plugins/factory/scripts/pr-body.ts:138-139`, `:179` | fixed |
| 2 | medium | Every existing file read passes `symbolicLinks: "follow"`, including files committed in a project (`docs/checkups/checkups.json`, `.claude/factory.json`, project settings), while `readText`'s own rule says branch-controlled content is read with `"refuse"`. | `plugins/factory/scripts/checkups.ts:578`, `settings.ts:205`, `toolbox.ts:242`; rule at `lib/files.ts:75` | fixed |
| 3 | medium | The decisions from the security fixes aren't recorded: required link choice for file reads, `"refuse"` for branch-controlled content, change folders as real folders under `docs/changes`. CLAUDE.md still names only `maxBytes`/`maxEntries`, and ADR 0056 still says "No new script". | `CLAUDE.md:26`, `docs/decisions/0056-docs-and-finish.md:39` | fixed |
| 4 | low | `verification.md` and `plan.md` lag behind the code: old test counts, the AC-1 test name, AC-9's evidence only covers the renderer, and the plan doesn't name the deviations that came with the security fixes. | `docs/changes/2026-10-02-pr-body/verification.md`, `plan.md` | fixed |
| 5 | low | Three tests of `evidence()` are labelled AC-4, but `evidence()` serves AC-3. | `plugins/factory/scripts/stage-gates.test.ts:537`, `:551`, `:555` | fixed |
| 6 | low | `buildPrBody` gates the documents in `readChange` and then reads them again to render them, so what's rendered isn't necessarily what passed the gate. | `plugins/factory/scripts/changes.ts:686`, `:701-716` | fixed |
| 7 | low | `<!--` is replaced with `&lt;!--` everywhere, including inside code spans, where GitHub shows `&lt;!--` literally. | `plugins/factory/scripts/pr-body.ts:97` | fixed |
| 8 | low | Command-level behaviour without a test: AC-8's refusal at the command, `--base` given twice, an extra argument, and the Ctrl-C edge case. | `plugins/factory/scripts/changes.test.ts` | fixed |
| 9 | low | The length is measured in UTF-16 code units (`body.length`) but documented as "characters". | `plugins/factory/scripts/pr-body.ts:13`, `:99` | fixed |
| 10 | low | Test hygiene: the case-insensitivity test returns early (a hidden skip), `lib/files.test.ts` still says "by default", and `decision-records.test.ts` shares one 30 s timeout signal across all tests. | `plugins/factory/scripts/changes.test.ts:867`, `lib/files.test.ts:101`, `plugins/factory/scripts/decision-records.test.ts:40` | fixed |
| 11 | medium | A project checkup skill whose `SKILL.md` is a symbolic link is read with `"refuse"`, but `readSkillDefaults` only catches a missing file, so the `SymbolicLinkError` crashes `checkups status` and the session-start reminder with a stack trace, while a symlinked schedule or settings file is reported as invalid. | `plugins/factory/scripts/checkups.ts:592-598`, `:622-628`, `:667-670` | fixed |
| 12 | low | ADR 0060 and CLAUDE.md describe the link rule more broadly than the code applies it: only the last part of a path is checked, `readDir` has no link choice, and `doctest.ts` reads a project's sources with `"follow"` without being named as an exception. | `docs/decisions/0060-reading-files-a-branch-controls.md`, `CLAUDE.md:26`, `plugins/factory/scripts/doctest.ts:303` | fixed |
| 13 | low | `reviewSection`'s doc comment still says "`null` when neither review is recorded or on the route"; only the route counts now. | `plugins/factory/scripts/pr-body.ts:143` | fixed |
| 14 | low | The Ctrl-C test doesn't kill the spawned CLI when an assertion fails before `cli.kill`, so a failed run can leave a `bun` process and its stand-in `sleep 30` running. | `plugins/factory/scripts/changes.test.ts:723-748` | fixed |
| 15 | low | A symbolic-link checkup skill is reported under the heading "docs/checkups/checkups.json is invalid:", although only the skill file is wrong, and `readCheckupDefaults`' doc comment doesn't say a linked project skill makes the checkup invalid. | `plugins/factory/scripts/checkups.ts:481`, `:521`, `:629` | open |
| 16 | low | A linked `.claude/factory.json` is reported with an absolute path and no "use a regular file", unlike the relative messages for the schedule and skills. | `plugins/factory/scripts/settings.ts:213-214` | open |
| 17 | low | The Ctrl-C test's `finally` kills only the CLI, not the stand-in git (a grandchild), and doesn't run at all when the test times out. | `plugins/factory/scripts/changes.test.ts:729`, `:748-752` | open |
| 18 | low | Small documentation gaps: `plan.md`'s Deviations misses the `checkups.ts`/`settings.ts` behaviour changes, CLAUDE.md misses the `doctest` exception, and AC-9's second evidence entry shortens a test name. | `docs/changes/2026-10-02-pr-body/plan.md`, `CLAUDE.md:26`, `verification.md:19` | open |


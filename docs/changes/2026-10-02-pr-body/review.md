# Review: Assemble a change's pull request description

## Summary

The change does what the spec asks: every criterion from AC-1 to AC-9 is met, each named test exists and passes, `bun run check` is green, and `pr-body` run on a copy of this change printed a correct description. The `pr-body` command's public answer in the Security section matches the code. What matters most is a bug: a skipped review stage's document is still rendered, and then claims "Every finding was fixed." even when a finding is open. The security fixes went beyond the plan, justified, but every existing file read got `symbolicLinks: "follow"` without a choice per site, and the new rules aren't recorded in an ADR or in CLAUDE.md.

## Findings

| # | Severity | Finding | Where | Status |
| - | -------- | ------- | ----- | ------ |
| 1 | medium | A review document whose stage is skipped is still rendered, and `findingsText` counts every finding that isn't accepted as fixed, so an open finding in a stale `security-review.md` comes out as "Every finding was fixed." | `plugins/factory/scripts/pr-body.ts:138-139`, `:179` | open |
| 2 | medium | Every existing file read passes `symbolicLinks: "follow"`, including files committed in a project (`docs/checkups/checkups.json`, `.claude/factory.json`, project settings), while `readText`'s own rule says branch-controlled content is read with `"refuse"`. | `plugins/factory/scripts/checkups.ts:578`, `settings.ts:205`, `toolbox.ts:242`; rule at `lib/files.ts:75` | open |
| 3 | medium | The decisions from the security fixes aren't recorded: required link choice for file reads, `"refuse"` for branch-controlled content, change folders as real folders under `docs/changes`. CLAUDE.md still names only `maxBytes`/`maxEntries`, and ADR 0056 still says "No new script". | `CLAUDE.md:26`, `docs/decisions/0056-docs-and-finish.md:39` | open |
| 4 | low | `verification.md` and `plan.md` lag behind the code: old test counts, the AC-1 test name, AC-9's evidence only covers the renderer, and the plan doesn't name the deviations that came with the security fixes. | `docs/changes/2026-10-02-pr-body/verification.md`, `plan.md` | open |
| 5 | low | Three tests of `evidence()` are labelled AC-4, but `evidence()` serves AC-3. | `plugins/factory/scripts/stage-gates.test.ts:537`, `:551`, `:555` | open |
| 6 | low | `buildPrBody` gates the documents in `readChange` and then reads them again to render them, so what's rendered isn't necessarily what passed the gate. | `plugins/factory/scripts/changes.ts:686`, `:701-716` | open |
| 7 | low | `<!--` is replaced with `&lt;!--` everywhere, including inside code spans, where GitHub shows `&lt;!--` literally. | `plugins/factory/scripts/pr-body.ts:97` | open |
| 8 | low | Command-level behaviour without a test: AC-8's refusal at the command, `--base` given twice, an extra argument, and the Ctrl-C edge case. | `plugins/factory/scripts/changes.test.ts` | open |
| 9 | low | The length is measured in UTF-16 code units (`body.length`) but documented as "characters". | `plugins/factory/scripts/pr-body.ts:13`, `:99` | open |
| 10 | low | Test hygiene: the case-insensitivity test returns early (a hidden skip), `lib/files.test.ts` still says "by default", and `decision-records.test.ts` shares one 30 s timeout signal across all tests. | `plugins/factory/scripts/changes.test.ts:867`, `lib/files.test.ts:101`, `plugins/factory/scripts/decision-records.test.ts:40` | open |

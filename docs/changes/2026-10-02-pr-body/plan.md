# Plan: Assemble a change's pull request description

## Approach

A pure renderer turns a change's parsed documents into the description; a thin command collects the inputs, refuses what isn't ready, and prints. All of it in unit `factory` (`plugins/factory/scripts/`), no new dependencies.

1. **Parsing helpers** in `stage-gates.ts`, next to the gates that already read these formats: the criteria with their text and whether they're dropped, the evidence per criterion, and the review findings as rows. The gates keep their own checks; the helpers expose what they already parse, so the formats are read in one place.
2. **`decision-records.ts`**: the decision records added on the branch, from git (`git diff --name-only --diff-filter=A <base>...HEAD -- docs/decisions`), each with whether its status is Proposed. git runs with an argument list, never through a shell, with the caller's signal plus a timeout. The base branch is checked first (`git rev-parse --verify --quiet`).
3. **`pr-body.ts`**: `renderPrBody(inputs)`, a pure function from the parsed documents to Markdown, which refuses a description over the limit. Pure, so it is deterministic (AC-9) and easy to test.
4. **`changes.ts`**: the `pr-body <change folder> [--base <branch>]` subcommand. It reads the change with every gate applied (AC-7), refuses while a stage before `finish` is pending or in progress (AC-6), runs the git part, renders, and prints only when everything succeeded (AC-1).
5. **`factory-finish`**: uses the command instead of assembling by hand.

## Files and data

- `plugins/factory/scripts/stage-gates.ts` and its test: three exported helpers (`criteria`, `evidence`, `reviewFindings`).
- `plugins/factory/scripts/decision-records.ts` and its test (new): `addedDecisionRecords(projectDir, { base, signal })`.
- `plugins/factory/scripts/pr-body.ts` and its test (new): `renderPrBody`, `PR_BODY_LENGTH_MAX = 65_536`.
- `plugins/factory/scripts/changes.ts` and its test: the subcommand; `dist/changes.js` regenerated.
- `plugins/factory/skills/factory-finish/SKILL.md`, `TODO.md` (the item is done), `GLOSSARY.md` if needed.
- No data or schema changes. Limits from the spec: 65,536 characters, 1 MiB per document (existing), at most 100 decision records.

## Trade-offs

- **Decision records from git, or from the documents' mentions of "ADR NNNN":** git, as the spec says. Mentions miss records written during the build. The cost is the plugin's first subprocess, so cancellation and a timeout need care (ADR 0012).
- **Helpers in `stage-gates.ts`, or a separate parser module:** in `stage-gates.ts`, because the gates already hold the regular expressions for these formats; a second copy would drift. The simplest option.
- **One file for everything:** rejected. A pure renderer next to an I/O-heavy command keeps the deterministic part testable without git.

## Costs

Negligible. At most six documents of at most 1 MiB, in practice a few KB each; one `git rev-parse` and one `git diff`, each well under a second; at most 100 small decision records read for their status line; output at most 64 KB. No batching needed.

## Conventions and decisions

Follows the conventions and ADRs. In particular:
- cancellation for git and file reads, with a timeout through the same signal (ADR 0012, `code-cancellation`);
- bounds with tests on both sides: description length, decision records (ADR 0032, 0034);
- parse, don't validate: git's output is parsed into paths, documents through the existing gates (ADR 0020);
- fail fast: refuse instead of printing a partial or truncated description (ADR 0048);
- results as objects or discriminated unions where an outcome is data (ADR 0017, 0041);
- TSDoc with tested examples on every export (ADR 0016).

No new decision needs an ADR: the change implements what ADR 0056 left to a script.

## Tasks

### T-1: Expose the documents' contents from the gates' parsers

- Files: `plugins/factory/scripts/stage-gates.ts`, `plugins/factory/scripts/stage-gates.test.ts`
- Covers: AC-3, AC-4
- Verify: `bun test plugins/factory/scripts/stage-gates.test.ts`
- Depends on: none
- Parallel: yes
- Status: done

### T-2: Find the decision records added on the branch

- Files: `plugins/factory/scripts/decision-records.ts`, `plugins/factory/scripts/decision-records.test.ts`
- Covers: AC-5
- Verify: `bun test plugins/factory/scripts/decision-records.test.ts`
- Depends on: none
- Parallel: yes
- Status: done

### T-3: Render the description

- Files: `plugins/factory/scripts/pr-body.ts`, `plugins/factory/scripts/pr-body.test.ts`
- Covers: AC-2, AC-3, AC-4, AC-5, AC-8, AC-9
- Verify: `bun test plugins/factory/scripts/pr-body.test.ts`
- Depends on: T-1
- Parallel: no
- Status: done

### T-4: Add the pr-body subcommand

- Files: `plugins/factory/scripts/changes.ts`, `plugins/factory/scripts/changes.test.ts`, `plugins/factory/dist/changes.js`
- Covers: AC-1, AC-6, AC-7
- Verify: `bun test plugins/factory/scripts/changes.test.ts` and `bun run validate`
- Depends on: T-2, T-3
- Parallel: no
- Status: done

### T-5: Use the command in the finish stage

- Files: `plugins/factory/skills/factory-finish/SKILL.md`, `TODO.md`
- Covers: none: the skill and the task list follow the new command
- Verify: `bun run check`
- Depends on: T-4
- Parallel: no
- Status: in-progress

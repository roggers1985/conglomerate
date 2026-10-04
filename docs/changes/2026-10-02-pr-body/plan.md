# Plan: Assemble a change's pull request description

## Approach

The description is built in two parts:

- a **renderer**: a pure function (no I/O, same input gives the same output) that turns the change's parsed documents into the description;
- a thin **command**: it collects the inputs, refuses a change that isn't ready, and prints the result.

Both live in unit `factory`, in `plugins/factory/scripts/`. They need no new dependencies.

The work comes in five steps:

1. **Parsing helpers in `stage-gates.ts`.** They sit next to the gates that already read these formats, and expose:
   - the criteria, with their text and whether they're dropped;
   - the evidence per criterion;
   - the review findings, as rows.

   The gates keep their own checks. The helpers expose what the gates already parse, so the formats are read in one place.
2. **`decision-records.ts`** finds the decision records added on the branch, each with whether its status is Proposed.
   - It checks the base branch first (`git rev-parse --verify --quiet`).
   - It then asks git for the added records (`git diff --name-only --diff-filter=A <base>...HEAD -- docs/decisions`).
   - git runs with an argument list, never through a shell. It takes the caller's signal plus a timeout, so it can be cancelled and can't hang.
3. **`pr-body.ts`** holds `renderPrBody(inputs)`: a pure function from the parsed documents to Markdown. It refuses a description over the limit. Because it is pure, it is deterministic (AC-9) and easy to test.
4. **`changes.ts`** gets the `pr-body <change folder> [--base <branch>]` subcommand. It:
   - reads the change with every gate applied (AC-7);
   - refuses while a stage before `finish` is pending or in progress (AC-6);
   - runs the git part and renders;
   - prints only when everything succeeded (AC-1).
5. **`factory-finish`** uses the command instead of assembling the description by hand.

## Files and data

The work touches four scripts with their tests, one skill, `TODO.md`, and `GLOSSARY.md` if needed.

| File | What changes |
|---|---|
| `plugins/factory/scripts/stage-gates.ts` and its test | Three exported helpers: `criteria`, `evidence` and `reviewFindings`. |
| `plugins/factory/scripts/decision-records.ts` and its test (new) | `addedDecisionRecords(projectDir, { base, signal })`. |
| `plugins/factory/scripts/pr-body.ts` and its test (new) | `renderPrBody`, and `PR_BODY_LENGTH_MAX = 65_536`. |
| `plugins/factory/scripts/changes.ts` and its test | The subcommand. `dist/changes.js` is regenerated. |
| `plugins/factory/skills/factory-finish/SKILL.md` | Uses the command. |
| `TODO.md` | The item is done. |
| `GLOSSARY.md` | Only if needed. |

No data or schema changes.

The limits come from the spec:

- the description: at most 65,536 characters;
- each document: at most 1 MiB (the existing limit);
- decision records: at most 100.

## Trade-offs

**Decision records: from git, or from the documents' mentions of "ADR NNNN"?** From git, as the spec says. Mentions miss records written during the build. The cost: git becomes the plugin's first subprocess, so cancellation and a timeout need care (ADR 0012).

**The helpers: in `stage-gates.ts`, or in a separate parser module?** In `stage-gates.ts`. The gates already hold the regular expressions for these formats, and a second copy would drift. It is also the simplest option.

**One file for everything?** Rejected. A pure renderer in its own file, next to the I/O-heavy command, keeps the deterministic part testable without git.

## Costs

Negligible. No batching needed.

| What | How much |
|---|---|
| Documents read | At most six, of at most 1 MiB each. In practice a few KB each. |
| git calls | One `git rev-parse` and one `git diff`, each well under a second. |
| Decision records read | At most 100 small ones, each only for its status line. |
| Output | At most 64 KB. |

## Conventions and decisions

This plan follows the conventions and ADRs. The ones that matter most here:

- **Cancellation:** git and file reads can be cancelled, with a timeout through the same signal (ADR 0012, `code-cancellation`).
- **Bounds:** the description's length and the number of decision records are limited, with tests on both sides of each limit (ADR 0032, 0034).
- **Parse, don't validate:** git's output is parsed into paths, and the documents are parsed through the existing gates (ADR 0020).
- **Fail fast:** refuse instead of printing a partial or truncated description (ADR 0048).
- **Results as data:** objects or discriminated unions where an outcome is data (ADR 0017, 0041).
- **Documentation:** TSDoc with tested examples on every export (ADR 0016).

No new decision needs an ADR. The change implements what ADR 0056 left to a script.

## Deviations

The security review and the review led to changes beyond the planned files. The reason for each is in those documents (`security-review.md`, `review.md`).

- **`lib/files.ts`:** `readText` and `readJson` refuse files that aren't regular files. They take a required `symbolicLinks` choice, and every call site passes one (security findings 1, 5 and 8; review finding 2).
- **`decision-records.ts`** reads records from git blobs instead of the working tree (security finding 1).
- **`changes.ts`** changes in four ways (security findings 2, 5 and 7):
  - the project folder comes from the change folder;
  - change documents and folders may not be symbolic links;
  - refusals are single `✗` lines;
  - `status` and `reminder` report one broken change as invalid, instead of failing.
- **`checkups.ts`, `settings.ts`:** a checkup schedule, project checkup skill or `.claude/factory.json` that is a symbolic link is refused instead of followed. It is reported as invalid, with a readable reason (review findings 2, 11, 15 and 16).
- **`stage-gates.ts`:** five regular expressions now run in linear time (security findings 4 and 6).
- **ADR 0060** records these decisions. CLAUDE.md and ADR 0056 follow it (review finding 3).

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
- Status: done

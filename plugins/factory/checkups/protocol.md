# Checkup protocol

Every checkup follows this protocol. A checkup skill only defines its scope; this file defines how to run it.

Terms used below:
- `<name>`: the checkup's name, e.g. `outdated-packages`
- `<today>`: today's date as `YYYY-MM-DD`
- **Schedule**: `docs/checkups/checkups.json` in the project
- **Reports**: `docs/checkups/<name>/YYYY-MM-DD.md`, one per run

## 1. Before you start

- Read the previous report in `docs/checkups/<name>/` (the newest), if there is one. Re-check its open items first; they are the cheapest wins.
- Read the project's `CLAUDE.md` and any conventions or ADRs it points to (e.g. `docs/decisions/`).
- Find the project's check commands (typecheck, lint, tests, build) in `CLAUDE.md`, `README.md` or `package.json`. You will need them before committing.
- Create a branch `checkup/<name>-<today>` from the default branch, unless the person running you says otherwise.

## 2. Hard rules

- **Never write to production.** No deploys, migrations or scripts that change production data. Only use read-only production access where the checkup allows it explicitly; otherwise list it under "Not checked".
- **Never push to the default branch**, force-push, or merge. Changes go on your branch.
- **Never** skip, disable or weaken tests, lint rules, type checks or git hooks (no `--no-verify`).
- **Never** commit secrets or paste them into a report.
- **Don't widen scope.** If you find something outside your checkup, note it under "Outside scope", naming the checkup it belongs to, instead of fixing it.

## 3. Doing the work

- Check claims against **primary sources** (official docs, release notes, legislation, the code itself) and cite them. Say what you could not verify.
- Fix what is small, safe and clearly in scope, in small commits, with tests where behaviour changes.
- Anything that needs a decision (wording, business rules, design, major upgrades, data deletion) goes under "Needs a human", with a concrete proposal.
- Prefer a handful of clear, verified wins over touching everything. List remaining candidates under "Next time".
- Before every commit, run the project's check commands. All must pass.

## 4. Finish

1. Write the report to `docs/checkups/<name>/<today>.md` using the template below. The report's date is what marks this checkup as done; there is nothing else to update.
2. Commit the report together with any fixes.
3. If the repository has a GitHub remote, push the branch and open a PR titled `Checkup: <name> (<today>)` with the summary as description. Otherwise leave the branch for the owner to merge.
4. Reply with the branch or PR link and the single most important finding.

## Report template

```markdown
# Checkup: <name> (<today>)

Model: <model you ran as, if known>
Previous report: <path or "none">

## Summary

<2–4 sentences: overall state and the most important finding.>

## Findings

| # | Severity | Finding | Evidence | Status |
| - | -------- | ------- | -------- | ------ |
| 1 | high / medium / low | … | file:line or source link | fixed / needs a human / open |

## Fixed in this run

- …

## Needs a human

- … (with a concrete proposal)

## Not checked

- … (and why)

## Outside scope

- … (for which checkup)

## Next time

- … (what to look at first on the next run)
```

---
name: checkup-code-quality
description: Code quality checkup. Checks code against the owner's conventions (readability, conditions, optionality, API design, parsing, cancellation, documentation), and looks for real bugs and structural problems. Use for "code quality checkup", "review the codebase", or when the checkup runner dispatches it.
metadata:
  task: checkup
---

# Checkup: code-quality

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Keeps the code readable and correct, and in line with the owner's conventions from the session context (`core.md` and the `code-*` skills).

## In scope

1. **Where to look**: the files changed since the previous report (`git log --since`), plus the riskiest modules (money, data writes, security, concurrency).
2. **Conventions**:
   - readability and declarative style;
   - one named condition per `if`, early returns;
   - optionality at the boundaries, `null` vs `undefined`, no nullable collections;
   - API design (positional vs options, result objects);
   - parsing external data with schemas;
   - cancellation;
   - documentation with tested examples.
3. **Bugs**:
   - unchecked errors, missing `await`, floating promises;
   - swallowed exceptions (`catch {}` without a reason);
   - unsafe casts (`as`, `any`, non-null `!`);
   - off-by-one errors, time zones, races, transactions that aren't atomic.
4. **Structure**:
   - circular dependencies;
   - exports only used inside their module;
   - duplicated logic that should be a helper;
   - utility-library usage that a small own helper would replace (the owner prefers own helpers).

## How to work

- Lint and type suppressions and TODO comments are the **todos** checkup's job; note them under "Outside scope".

## Fixes you may make yourself

- Small, behaviour-preserving refactors with tests, one convention or pattern per commit.
- Bug fixes with a test that reproduces the bug first.

## Allowed production access

None.

## Always "Needs a human"

- Changes to public APIs that other packages or projects use.
- Places where a convention seems wrong for the code, as a question about the convention.

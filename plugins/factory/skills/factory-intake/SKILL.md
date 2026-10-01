---
name: factory-intake
description: The factory's intake stages. Writes a change's intent.md (the problem, the outcome, who and what it affects, constraints, open questions) and spec.md (current behaviour, acceptance criteria in EARS form, edge cases, limits, what's out of scope), with the owner, and holds the gate until the owner approves. No implementation. Use when a route's intent or spec stage starts, or when the owner asks to write or revise a change's intent or spec.
metadata:
  task: planning
---

# Intake

Intake decides **what** to build, never how. It turns the owner's request into two documents in the change's folder (`docs/changes/<name>/`, next to `task.md`), and ends at the first human gate. Both stages always run at `guided`: what to build is the owner's (ADR 0051, 0052).

## The intent stage: `intent.md`

Written with the owner, and corrected by them. Short: a page at most.

```markdown
# Intent: <title>

## Problem

What is wrong or missing today, for whom, and how we know.

## Outcome

What is different when this is done, in the owner's and users' terms. How we'll know it worked.

## Affected

The users, systems, units (`docs/architecture/`) and data this touches.

## Constraints

Deadlines, budgets, compatibility, regulations, decisions (ADRs) it must respect.

## Open questions

What the spec has to answer. "None." when there are none.
```

## The spec stage: `spec.md`

What the system does when the change is done, precisely enough to test, and nothing about how it's built (no files, classes, libraries or schemas).

```markdown
# Spec: <title>

## Current behaviour

What the system does today in this area, from the code and docs, so the change builds on it instead of rebuilding
it. For something entirely new: "Nothing exists yet."

## Acceptance criteria

- **AC-1**: WHEN the owner exports jobs, THE SYSTEM SHALL download them as a CSV file.
- **AC-2**: WHILE an export runs, THE SYSTEM SHALL disable the export button.
- **AC-3**: IF the export fails, THEN THE SYSTEM SHALL show the reason and keep the page usable.

## Edge cases

Found systematically (see `code-testing`): empty, one, many, at and past every limit, invalid input, cancellation,
concurrent use, missing permissions. Each with the expected behaviour, or a criterion above that covers it.

## Limits

The bounds of every input, collection and wait this change introduces (ADR 0032, 0034): e.g. "at most 10,000 jobs
per export; larger exports are refused with a message".

## Security

- Authentication: who must be logged in, e.g. "only logged-in users", or "Public, because …"
- Authorisation: who may do what, e.g. "only the job's owner may export it"
- Untrusted input: what comes from outside, and that it's parsed with a schema at the boundary
- Sensitive data: personal or secret data this touches, and who may see it, or "none"

## Out of scope

What this change deliberately doesn't do, so nobody builds it by accident.
```

### Security, by default

Every change that has an entry point (an endpoint, a server action, a webhook, a command, a job) answers the four security questions, even when the application has no authentication yet (ADR 0057). "Public, because …" is a valid answer; "not yet" is not an answer but a decision. If the owner wants to ship before authentication or authorisation exists, write that in the answer, and the review will make it a high finding that only the owner can accept, with a tracked task to add it. Nothing ships without it quietly.

Add a `## Problem` section at the top when the route has no intent stage (triage combined them).

### Acceptance criteria in EARS form

Every criterion is numbered (`AC-<n>`, unique) and follows one of the EARS patterns, with the keywords in capitals:

| Pattern | Form |
|---|---|
| Ubiquitous | THE SYSTEM SHALL … |
| Event | WHEN <trigger>, THE SYSTEM SHALL … |
| State | WHILE <state>, THE SYSTEM SHALL … |
| Unwanted behaviour | IF <condition>, THEN THE SYSTEM SHALL … |
| Optional feature | WHERE <feature is present>, THE SYSTEM SHALL … |

One behaviour per criterion; each must be testable as written. The plan and the tests refer to the ids, so an id never changes meaning: add new ones, and mark a dropped one as "(dropped)" instead of reusing it.

## Unclear points

Never guess. Mark anything the owner must decide as `[NEEDS CLARIFICATION: <the question>]`, and ask. Recommend an answer where you can (`core.md`: always have a recommended option), but the owner decides.

## The gate

1. Set the stage to `in-progress` in `task.md` when you start it.
2. Write the document with the owner; resolve every `[NEEDS CLARIFICATION]` with them.
3. **Wait for the owner's approval** of the document. This is a human gate at every autonomy level.
4. Set the stage to `done` and run `bun "${CLAUDE_PLUGIN_ROOT}/dist/changes.js" check docs/changes/<name>/task.md`. It refuses a done stage whose document is missing a section, has a criterion that isn't in EARS form, or still has an open `[NEEDS CLARIFICATION]`. Fix what it reports, then commit.

When writing the spec shows the task is bigger or riskier than triage thought, stop and re-triage (see `factory-triage`).

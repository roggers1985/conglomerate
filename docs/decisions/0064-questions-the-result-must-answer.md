# 64. Questions the result must answer

Date: 2026-10-12

## Status

Proposed

Would extend [ADR-0052](0052-intake-intent-and-spec.md), [ADR-0054](0054-build-verify-and-spike.md) and [ADR-0055](0055-review-and-security-review.md), and generalise the pattern of [ADR-0057](0057-secure-by-default.md). It would not be built until the first real change has run through the stages (the `TODO.md` item on ADR 0056).

## Context

The factory checks two kinds of things after a build:

- **Behaviour.** Each acceptance criterion in `spec.md` needs evidence in `verification.md`, and the review breaks the code to see its test fail (ADR 0054, 0055, 0063).
- **Security.** The four security questions are answered in the spec, and the review checks them on every entry point (ADR 0057).

Other questions get no such treatment. Examples: what happens at ten times the load, whether the change can be rolled back, what it assumes about the data, who notices when it breaks. These are not behaviours, so no test covers them. Today they live in three places that don't reach the end of the change:

- `## Open questions` in `intent.md`, and `[NEEDS CLARIFICATION]` markers, which are answered before the build and never checked afterwards;
- the `grill-me` skill, which interrogates a plan once and leaves no record the review can use;
- the reviewer's own judgement, which depends on what that reviewer thinks of.

So a question that was asked can be forgotten, and a question that was never asked leaves no trace.

## Decision

**Generalise the pattern of ADR 0057: questions are defined before the build, and checked after it.**

1. **The spec gets a `## Questions` section.** Each entry is `- <question>: <expected answer or how it will be checked>`. It is seeded from a short default list per task type, which the owner can extend. The security questions stay in their own section (ADR 0057), unchanged. "None, because …" is valid for a change where the defaults don't apply.
2. **A question is not a criterion.** A criterion states a behaviour a test can check. A question asks about a quality, a risk or an assumption that a test can't settle. If a question can be written as a criterion, it is moved there.
3. **The build answers each question** in a `## Answers` section of `verification.md`: the question, the answer, and the evidence (a measurement, a file, a decision, a command's output). "Not applicable" needs a reason.
4. **The review checks the answers,** as it checks evidence for criteria: an unanswered question, or an answer without evidence, is a finding. An answer that contradicts the evidence is a high finding.
5. **The gate enforces the form,** as it does for criteria: `changes.js check` refuses a done spec stage without the section, and a done verify stage with an unanswered question.
6. **The default lists are short.** At most five questions per task type, so the section doesn't turn into a form that is filled in and ignored. The `checkup-retro` checkup reviews which defaults actually led to a finding, and removes those that never did.

## Alternatives considered

| Option | Why not |
|---|---|
| A new stage for questions | The questions belong with the spec (asked) and the verification (answered). A stage adds ceremony and a place to forget. |
| Fold them into acceptance criteria | A criterion must be testable. Forcing "is it reversible?" into EARS form produces criteria that no test can check. |
| Use `intent.md`'s open questions | They are for what the owner must decide *before* building. They have no answer-and-evidence step afterwards. |
| Leave it to the reviewer | The reviewer then checks what it thinks of, not what the owner asked. |

## Consequences

- Every change on the standard and full tracks records which questions it was asked and how each was answered, so the review has something concrete to check.
- The owner can add a question to a change and know it will be checked.
- More text per change. The limit of five defaults and the retro's pruning are there to keep that in check.
- It touches intake, planning, build, review, the gates and the templates, so building it is a large change in its own right. It goes through the full track.

## Open points for the owner

- **Which questions are the defaults?** A first proposal: *load and limits*, *rollback*, *assumptions about data and users*, *who notices a failure*, *what is deliberately left out*. This needs the owner's list.
- **When to build.** Recommended: after the first real change shows which questions actually get missed, so the defaults come from evidence.
- **Should the quick track have it?** Recommended: no. The quick track has no spec (ADR 0052), and one question line in the commit message is enough there.

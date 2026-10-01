# 57. Secure by default: authentication and authorisation

Date: 2026-10-01

## Status

Accepted

Extends [ADR-0051](0051-stage-0-triage.md), [ADR-0052](0052-intake-intent-and-spec.md) and [ADR-0055](0055-review-and-security-review.md).

## Context

Until now, security got attention when triage *recognised* a change as security-related and added a security review. The owner wants authentication and authorisation to get attention always. That an application has no authentication yet doesn't mean it shouldn't have it, and nothing should ship while it quietly lacks a security aspect.

## Decision

- **The spec has a required Security section** that answers four questions, each as `- <question>: <answer>`:
  - **Authentication:** who must be logged in;
  - **Authorisation:** who may do what;
  - **Untrusted input:** what comes from outside, and that it's parsed at the boundary;
  - **Sensitive data:** what personal or secret data it touches, and who may see it.

  "Public, because …" is a valid answer. "Not yet" is a decision, not an answer. The spec's gate refuses a spec that leaves a question unanswered.
- **Triage adds the security review by rule, not by judgement,** whenever a change adds or changes an entry point (an endpoint, a server action, a webhook, a command, a job), authentication or authorisation, the handling of untrusted input, or sensitive data.
- **Every review checks authentication and authorisation on every entry point** the change adds or touches, even without a security-review stage. A missing check is a high finding, unless the spec marks the entry point as public and says why.
- **Nothing ships without it quietly.** Only the owner can accept a high finding (ADR 0055), and the finish stage waits while one is open (ADR 0056). Shipping before authentication exists is therefore always the owner's explicit decision, recorded with its reason, together with a tracked task to add it.
- **`core.md` says so, in every session:** every entry point requires authentication and authorisation, unless the spec marks it public.

## Consequences

- Every spec says who may use what it describes, including the "public" cases, which are now deliberate.
- More changes get a security review, and so more Opus review runs. That is accepted for anything with an entry point.
- The rule is enforced in three places: the spec gate (the questions answered), the review (high findings), and the owner-only acceptance of high findings. A model can't drop it in one place without another catching it.

# 1. Record architecture decisions

Date: 2026-09-29

## Status

Accepted

## Context

This repository grows into a software factory one deliberate addition at a time. Every addition is discussed before it is made. Without a written record, the reasoning behind those discussions is lost, and both humans and agents working in the repo would have to guess why things are the way they are.

## Decision

We record every architecturally significant decision as an Architecture Decision Record (ADR), using the format described by Michael Nygard in [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

- ADRs live in `docs/decisions/`, numbered sequentially: `NNNN-title-in-kebab-case.md`.
- Each ADR has the sections: Title, Date, Status, Context, Decision, Consequences.
- Status is one of: Proposed, Accepted, Deprecated, Superseded by ADR-NNNN.
- ADRs are immutable once accepted. To change a decision, write a new ADR that supersedes the old one.

## Consequences

- Every addition to the factory starts as a discussion and ends as an ADR, so the history of "why" is kept next to the code.
- Agents can read `docs/decisions/` to follow earlier decisions instead of inventing new conventions.
- Writing an ADR adds a small cost to each decision. We accept that in exchange for control and traceability.

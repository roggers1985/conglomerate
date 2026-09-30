# 45. Architecture checkup and register

Date: 2026-09-30

## Status

Accepted. Extended by [ADR-0051](0051-stage-0-triage.md): triage may add an architecture stage for tasks that touch open debt. Extended by [ADR-0046](0046-reassessing-architecture-when-drivers-change.md): drivers are recorded and rechecked, and accepted risk expires after 12 months.

Amends [ADR-0023](0023-complete-generic-checkups-and-project-overrides.md) (one more generic checkup) and [ADR-0044](0044-autonomy-levels.md) (architecture changes are always the owner's).

## Context

Most of the owner's applications are existing ones with accumulated technical debt. Sometimes their architecture was never right, sometimes it drifted there. Agents working in them tend to keep the architecture as it is:
- every task is local, and working around the structure is cheaper for that one change;
- existing code reads as the convention;
- no task asks whether the structure still fits;
- a restructuring doesn't fit into one change;
- no session remembers that this is the tenth workaround in the same place.

No existing checkup covers this. `code-quality` looks at recent changes and at structure within modules.

The owner wants architecture improvements at least put on the agenda, or a record of why not. Many repositories consist of several apps or packages (monorepos), so the assessment must be explicit about what it is about, rather than treating the whole repository as the target by default.

## Decision

- **A generic `architecture` checkup** that assesses and never restructures. It runs as the `planning` task type (Opus, high effort), because it is judgement work. It runs every 90 days at `normal` priority, and on demand before a large feature.
- **Explicit scope:**
  - the checkup first maps the units (workspaces, packages, apps, services; a repository without them is one unit);
  - it states each run's scope;
  - it labels every finding `unit <name>`, `boundary <a> ↔ <b>` or `repository`;
  - a `repository` proposal is possible, but only with evidence that spans units, and never by default.
- **As-is, then to-be, then the gap.** The to-be architecture is written *before* comparing it with the code, so the existing structure doesn't set the standard. The simplest architecture that fits is preferred.
- **Evidence of pain is required** for a proposal:
  - hotspots and change coupling from git history;
  - where bugs are fixed;
  - dependency cycles and layer violations;
  - findings that other checkups keep reporting;
  - recorded workarounds.

  Git history comes first. A dependency analyser can be added through the toolbox later if it's missing.
- **Every candidate becomes a Proposed ADR:**
  - its scope, the pain and the options, always including "keep it as it is";
  - an incremental migration path;
  - a recommendation;
  - when to reconsider.

  The owner accepts it (the steps become tracked tasks) or rejects it (the reason is recorded, and the debt is marked "accepted risk"). Rejected proposals come back only when a reconsider condition is met or new evidence appears.
- **The architecture register, `docs/architecture/`:**
  - a map of units, with an as-is overview per unit;
  - the debt table, with statuses and reconsider conditions;
  - a workaround log.

  The checkup keeps it. Everyone else adds to its workaround log: `core.md` asks for a line there whenever a task needs a workaround because of the architecture.
- **Accepting or rejecting a change of architecture is always the owner's,** at every autonomy level.
- **Later, with Stage 0:** when a task touches open debt in the register, triage may propose a route that fixes the architecture first. This is tracked in `TODO.md`.
- **This repository schedules it too,** because it has several parts (`lib/`, the plugin, repository scripts) and an open monorepo question.

## Consequences

- Architecture gets a regular, recorded decision, even when that decision is to keep it.
- The register gives later sessions the memory that a single task lacks.
- The checkup costs more per run than others (Opus), which is accepted for a 90-day interval.
- Its quality depends on the evidence available: a young repository with little history gives thin evidence, and the checkup should say so rather than guess.

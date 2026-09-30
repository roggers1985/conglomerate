---
name: checkup-architecture
description: Architecture checkup. Assesses whether a project's architecture still fits what it does, per explicitly scoped unit (an app or package in a monorepo, the boundaries between them, or the whole repository). Compares the architecture as it is with the one a good team would choose today, backs every candidate with evidence from git history and earlier findings, and turns each into a proposed decision, including "keep it as it is", with an incremental migration path. Keeps the architecture register. Never restructures. Use for "architecture checkup", "is our architecture still right", before a large feature, or when the checkup runner dispatches it.
metadata:
  task: planning
---

# Checkup: architecture

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

Agents working in an existing application tend to keep its architecture as it is: every task is local, and working around the structure is always cheaper *for that one change*. This checkup asks the question no task asks: does the architecture still fit, and if not, what should change, in which steps? Or should it stay, and why? Every candidate ends in a recorded decision, either way (ADR 0045).

**This checkup assesses; it never restructures.** Its output is the register, proposed decisions and a plan. Changing the architecture is always the owner's decision, at every autonomy level.

## 1. Units and scope

Before assessing anything, set the boundaries.

- **Find the units:** the independently built or deployed parts of the repository, such as workspaces and packages (`package.json` workspaces, `pnpm-workspace.yaml`, Nx or Turborepo projects, Go modules, Cargo workspaces), and apps and services. A repository without them is one unit.
- **Record them** in the register's unit map (see 5): name, path, purpose, and which units each one depends on.
- **Choose this run's scope, and state it at the top of the report:**
  - the scope the runner or the owner gave, if any;
  - otherwise **one or a few units**: those with the most evidence (step 3), or those assessed longest ago according to the register. Plus a short look at the **boundaries between units** as a whole.
- **Label every finding and proposal with its scope,** in exactly these words:
  - `unit <name>`: inside one unit;
  - `boundary <a> ↔ <b>`: between two units;
  - `repository`: the repository as a whole (its split into units, shared tooling, or merging or splitting units).

  A `repository` proposal is allowed, but only with evidence that spans several units, and never as the default. Never let "the architecture" mean the whole monorepo without saying so.

## 2. As-is and to-be

For each unit in scope:

- **As-is,** derived from the code: its modules and layers, the direction of dependencies, where the business rules live, how data flows in and out, and how it talks to other units. Keep it short: a list or a small diagram, not a tour of every file.
- **To-be:** the architecture a good team would choose *today* for what this unit actually does: its requirements, its load, its rate of change, and the team working on it. **Write this before comparing it with the code,** so the existing structure doesn't set the standard. Prefer the simplest architecture that fits; a to-be that is more elaborate than the problem needs is also a finding.
- **The gap:** where the two differ, and only then whether each difference hurts (step 3).

## 3. Evidence

Every candidate needs evidence of pain, not only a mismatch with taste. From git history (no extra tools needed):

- **Hotspots:** files that change often and are complex. For example, count changes per file over the last 6–12 months with `git log --format= --name-only --since=<date>`, and weigh them by size or nesting.
- **Change coupling:** files in different modules or units that keep changing in the same commits. They point to a boundary in the wrong place.
- **Where bugs are fixed:** commits whose message says fix, bug or regression, per module.

From the project:

- **Dependency problems:** cycles, and imports that go against the intended direction, e.g. a domain module importing from the UI or database layer, or one unit reaching into another's internals.
- **Recurring findings:** what earlier checkups (`code-quality`, `performance`, `security`, `test-coverage`) keep reporting in the same place.
- **Recorded workarounds:** entries in the register's workaround log (see 5).

A difference without evidence goes into the report as an observation, not as a proposal.

## 4. Proposals

For each candidate with evidence, write a **Proposed** ADR in the project's decision records (the owner decides, as the autonomy rules say for architecture). It contains:

- **Scope,** in the words from step 1.
- **The pain,** with the evidence.
- **The options,** always including **keep it as it is**, each with its cost, benefit and risk.
- **An incremental migration path** for the options that change something: steps that can each be released, with the old and new structure side by side where needed (e.g. strangling one part at a time behind a stable interface). No big-bang rewrite unless the evidence shows smaller steps can't work.
- **A recommendation,** with its reason.
- **When to reconsider:** for the recommended option, the conditions that would change the answer, e.g. "when a second payment provider is added", or "when this module changes more than weekly".

Three well-argued proposals beat ten thin ones. When nothing hurts enough, say so; that is a good outcome.

## 5. The architecture register

Keep `docs/architecture/README.md` in the project, and create it on the first run. For a repository with several units, give each assessed unit its own `docs/architecture/<unit>.md` and keep the README as the map.

- **Unit map:** each unit with its path, purpose and dependencies, and when it was last assessed.
- **As-is overview:** per unit, from step 2, updated when it changes.
- **Debt table:** one row per known architectural problem: scope, description, status (`open`, `planned`, `accepted risk`, `done`), its ADR, and when to reconsider.
- **Workaround log:** short entries that other work adds when it has to work around the architecture (date, scope, what and why). Each run turns them into evidence and clears the ones it has handled.

Rejected proposals stay in the debt table as `accepted risk`, with their reconsider conditions. **Don't propose them again unless a condition has been met or new evidence appeared,** and say which.

## Fixes you may make yourself

- Create and update the register: the unit map, the as-is overviews, and the debt table's statuses for decisions the owner has already made.
- Nothing in the code.

## Allowed production access

None. Load, error rates and similar figures come from the monitoring checkup's reports or the owner.

## Always "Needs a human"

- Every proposal: accepting it (the ADR becomes accepted, and its steps become tracked tasks) or rejecting it (the ADR records why not; the debt table records it as `accepted risk`, with when to reconsider).
- A `repository` scope proposal, such as splitting, merging or restructuring units: name it separately in the summary.

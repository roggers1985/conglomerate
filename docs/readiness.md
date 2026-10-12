# Readiness for a public marketplace

Where the factory stands compared with the alternatives, and what's still missing before it's worth publishing. The owner reads this instead of asking again (ADR 0050).

**Last updated:** 2026-10-10: tests are now written by a different agent than the code, with an arbiter for disputes, and the review proves tests can fail (ADR 0062, 0063). Earlier, on 2026-10-04: two real changes went through the stages end to end in this repository: the pull request description command (pull request #14, standard track with a security review) and the writing convention (pull request #16, three review rounds). The delivery stages now work in practice, not only on paper. The `readiness` checkup refreshes this document every 60 days, and Claude updates it whenever a milestone is finished, such as a factory stage.

## Verdict

**Not ready yet.** The factory is ahead of every alternative on keeping an existing codebase healthy: checkups, the architecture register, model routing, autonomy levels, decision records, enforcement and tool security. Its delivery stages now work: two real changes in this repository went from triage to a merged pull request. What it still lacks is use on another codebase, and the packaging a stranger needs to install and trust it.

**Two ways to get there:**
- **Complete:** the delivery stages exist and are used (done). Using them on another project, an existing application, is the next proof.
- **Complementary:** publish sooner as a health and conventions pack that works *next to* Superpowers, Spec Kit or OpenSpec for delivery. This would probably already pass the owner's test that it "clearly adds something".

Either way, it needs the packaging criteria below.

## Criteria for "ready"

| # | Criterion | Status | Notes |
| - | --------- | ------ | ----- |
| 1 | Clearly adds something over the alternatives (the owner's test, `TODO.md`) | ✓ for health and maintenance, ~ for delivery | Delivery works, but has only been used in this repository. See the comparison below |
| 2 | Delivery stages in first form: spec, plan, build, review | ✓ | All stages exist (ADR 0051 to 0056) and were used on two real changes in this repository (pull requests #14 and #16). Not yet used on another project |
| 3 | One-command install from a public repository (`/plugin marketplace add owner/repo`), with the Bun requirement stated | ✗ | The repository is private; installs from a local clone today |
| 4 | A README that shows what you get in five minutes, with a real example session | ✗ | The README lists the USPs, but has no walkthrough |
| 5 | A "start here" path through the surface area (18 checkups, 12 `code-*` skills) | ✗ | `CATALOG.md` exists, but no recommended first step |
| 6 | Usable without the owner's whole setup: parts can be adopted separately (conventions only, checkups only) | ~ | Checkups are opt-in per project; the conventions are always on |
| 7 | Versioned releases, a changelog, and upgrade notes | ✗ | No tags or `CHANGELOG.md` yet |
| 8 | A privacy and security statement | ✗ | There is no telemetry, so this is cheap to write |
| 9 | Stability signals: CI, tests, supported Claude Code versions, a breaking-change policy | ~ | CI and self-checks are strong; there is no statement of supported versions or breaking changes |
| 10 | A contribution and support route (CONTRIBUTING, issue templates) | ✗ | |
| 11 | Evidence that the skills help (evals) | ✗ | In `TODO.md` ("Evals for the plugin's skills") |
| 12 | Licence and third-party notices | ✓ | MIT, notices generated (ADR 0027, 0035) |

## Comparison

Facts from the projects' own repositories and documentation, read on 2026-09-30. Stars indicate popularity, not quality.

| Project | What it is | Licence | Stars | Latest release | Hosts |
| ------- | ---------- | ------- | ----- | -------------- | ----- |
| **factory** (this) | Conventions, checkups, architecture register, model routing, autonomy levels, ADRs, toolbox | MIT | private | none | Claude Code |
| [Superpowers](https://github.com/obra/superpowers) | Development methodology as skills: brainstorm, spec, plan, subagent-driven build with review, finish a branch | MIT | 293k | v6.4.2 (2026-09-25) | 16, incl. Anthropic's official marketplace |
| [Spec Kit](https://github.com/github/spec-kit) | Spec-driven development: constitution, specify, plan, tasks, implement; about 176 community extensions | MIT | 140k | v1.0.13 (2026-09-29) | about 40 |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Living specs, plus per-change proposals that are archived when done; built for brownfield | MIT | 71k | v1.13.2 (2026-09-23) | 30+ |
| [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | Role-based agile workflows (PM, architect, dev, test architect), sized to the change | MIT + trademark notice | 54k | v6.12.0 (2026-09-04) | skill-capable tools, Claude Code marketplace |
| [Kiro](https://kiro.dev/docs/specs/) | Agentic IDE and CLI with specs, steering files and hooks | proprietary, $0–200/month | n/a | n/a | its own environment |
| [Anthropic's AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook) | Guidance: Plan, Design, Build, Test, Deploy, Maintain, each with an artifact and a human gate; governance as code | documentation | n/a | 2026-08-21 | Claude |
| [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) | 36 skills: brainstorm, plan, work, review, then write the learning down | MIT | 25k | v3.30.1 (2026-09-29) | 14 |
| [Agent OS](https://github.com/buildermethods/agent-os) | Discover and deploy a codebase's standards, shape specs | MIT | 5.5k | v3.0.0 (2026-01-20) | several |
| [ECC](https://github.com/affaan-m/ECC) | Large agent harness: agents, skills, hooks, memory, a security scanner (AgentShield) | MIT | 270k | (active) | several |

**Coverage by dimension.** ✓ covered, ~ partial, ✗ not covered. This is an interpretation of the facts above; projects read only at README level are less certain.

| Dimension | factory | Superpowers | Spec Kit | OpenSpec | BMAD | Kiro | Playbook | Compound Eng. |
| --------- | ------- | ----------- | -------- | -------- | ---- | ---- | -------- | ------------- |
| Coding conventions | ✓ deep, enforced | ~ | ~ | ✗ | ~ | ✓ | ~ | ~ |
| Spec, plan and task stages | ✓ triage, intake, planning | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Review | ✓ separate reviewer, severity rules, mutation check | ✓ | ~ | ~ | ✓ | ~ | ✓ | ✓ |
| Recurring maintenance checks | ✓ 18, scheduled, as PRs | ✗ | ✗ | ✗ | ✗ | ✗ | ~ advice | ~ |
| Architecture assessment | ✓ checkup and register | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ |
| Model routing and cost | ✓ | ✗ | ✗ | ✗ | ✗ | ~ | ~ | ~ |
| Autonomy settings | ✓ 3 levels | ~ | ~ | ~ | ~ | ~ | ✓ | ~ |
| Decision records | ✓ ADRs | ✗ | ~ | ~ | ~ | ✗ | ~ | ~ |
| Enforcement by scripts, hooks, lint | ✓ | ✗ | ~ | ~ | ~ | ~ | ✓ advised | ~ |
| Tool and plugin security | ✓ toolbox | ✗ | ✗ | ✗ | ✗ | ~ | ✓ | ~ |
| Existing codebases | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | ~ | ~ |

## Where the factory is ahead

- **Keeping code healthy after delivery.** No popular alternative ships scheduled, generic checkups that run in worktrees and hand over pull requests. Compound Engineering's sweeps are the nearest, and they target product feedback. The playbook describes a Maintain stage without an implementation.
- **The architecture checkup and register,** including drivers and expiring accepted risk. No equivalent was found.
- **Model routing per task type,** with a checkup that reviews it.
- **Configurable autonomy,** instead of hard-wired gates.
- **A decision record for every decision.**
- **Mechanical enforcement** of its own rules (strict types, lint, doctests, validators), where most alternatives rely on prompts. This matches the playbook's own point that hooks are deterministic and instructions are advisory.
- **A trust list with security records** for tools and plugins.

## Where it lags

- **The delivery stages are young:** used on two changes, both in this repository, which is small and has no users, database or UI. How they hold up in an existing application is still unknown.
- **Reach:** Claude Code only; a local install that needs Bun. The leaders run on 14 to 40 hosts and install with one command.
- **Packaging:** no releases, changelog, walkthrough or community channel.
- **An opinion, not a methodology:** the conventions are one person's taste (TigerStyle-inspired, TypeScript-first). That's a strength for some users and a narrow audience for others.
- **No evals** yet, and the autonomy levels aren't enforced by hooks yet.

## Not verified

- Kiro's use of EARS, its hook details, autonomy modes and security features: its documentation pages were thin.
- Adoption beyond stars (downloads, contributors).
- Whether other projects' review gates have any enforcement beyond prompts.
- Anthropic's official marketplace submission requirements. This matters for the publishing decision; the `readiness` checkup should look it up.
- Two community implementations of the playbook (jsnkle/ai-native-sdlc, bashebr/ai-native-sdlc).

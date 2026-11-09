# Readiness for a public marketplace

Where the factory stands compared with the alternatives, and what's still missing before it's worth publishing. The owner reads this instead of asking again (ADR 0050).

**Last updated:** 2026-10-12, by the `readiness` checkup: the facts about the alternatives are refreshed, Anthropic's submission requirements are added, and pull request #17 is counted (merged the same day: behaviour tests for migrations, and tests written apart from the code, ADR 0062 and 0063). Earlier, on 2026-10-04, two real changes went through the stages end to end in this repository: the pull request description command (pull request #14, standard track with a security review) and the writing convention (pull request #16, three review rounds). The `readiness` checkup refreshes this document every 60 days, and Claude updates it whenever a milestone is finished, such as a factory stage.

## Verdict

**Not ready yet.** The factory is ahead of every alternative on keeping an existing codebase healthy: checkups, the architecture register, model routing, autonomy levels, decision records, enforcement and tool security. Its delivery stages now work: three real changes in this repository went from triage to a merged pull request. What it still lacks is use on another codebase, and the packaging a stranger needs to install and trust it.

**Two ways to get there:**
- **Complete:** the delivery stages exist and are used (done). Using them on another project, an existing application, is the next proof.
- **Complementary:** publish sooner as a health and conventions pack that works *next to* Superpowers, Spec Kit or OpenSpec for delivery. This would probably already pass the owner's test that it "clearly adds something".

Either way, it needs the packaging criteria below. Publishing through the repository's own marketplace needs only a public repository. A listing in Anthropic's directory adds an automated and a human review. The plugin has one blocking gap there, a README in the plugin folder, and two likely holds for a reviewer (see "What Anthropic's directory checks").

## Criteria for "ready"

| # | Criterion | Status | Notes |
| - | --------- | ------ | ----- |
| 1 | Clearly adds something over the alternatives (the owner's test, `TODO.md`) | ✓ for health and maintenance, ~ for delivery | Delivery works, but has only been used in this repository. See the comparison below |
| 2 | Delivery stages in first form: spec, plan, build, review | ✓ | All stages exist (ADR 0051 to 0056) and were used on three real changes in this repository (pull requests #14, #16 and #17; the last on the full track, with three review rounds). Not yet used on another project. The arbiter for a disputed test (ADR 0063) hasn't ruled yet: no test was disputed in pull request #17 |
| 3 | One-command install from a public repository (`/plugin marketplace add owner/repo`), with the Bun requirement stated | ✗ | The repository is private (GitHub, checked 2026-10-12); installs from a local clone today. Claude Code's publishing guide: once `marketplace.json` is in a public repository, the plugin is published and installs with `claude plugin marketplace add owner/repo` |
| 4 | A README that shows what you get in five minutes, with a real example session | ✗ | The README lists the USPs, but has no walkthrough. Anthropic's policy asks for at least three example prompts or use cases (3E) |
| 5 | A "start here" path through the surface area (18 checkups, 11 `code-*` skills) | ✗ | `CATALOG.md` exists, but no recommended first step |
| 6 | Usable without the owner's whole setup: parts can be adopted separately (conventions only, checkups only) | ~ | Checkups are opt-in per project; the conventions are always on |
| 7 | Versioned releases, a changelog, and upgrade notes | ✗ | No tags or `CHANGELOG.md` yet; `plugin.json` says `0.1.0`. Claude Code's docs: raise `version` on every release, or omit it so the commit SHA is used; `claude plugin tag` creates the tag |
| 8 | A privacy and security statement | ✗ | There is no telemetry and no network code in the plugin's scripts (searched 2026-10-12), so this is cheap to write. Anthropic's directory scan expects the README to describe everything the plugin runs, sends or fetches |
| 9 | Stability signals: CI, tests, supported Claude Code versions, a breaking-change policy | ~ | CI and self-checks are strong, and `claude plugin validate --strict` passes on the plugin (2026-10-12); there is no statement of supported versions or breaking changes |
| 10 | A contribution and support route (CONTRIBUTING, issue templates) | ✗ | Anthropic's policy asks for verified contact information and a support channel (3B) |
| 11 | Evidence that the skills help (evals) | ✗ | In `TODO.md` ("Evals for the plugin's skills"). Claude Code ships `claude plugin eval`, and Anthropic's pre-submission checklist suggests running it |
| 12 | Licence and third-party notices | ✓ | MIT, notices generated (ADR 0027, 0035) |

### What Anthropic's directory checks

Facts from Anthropic's documentation, read on 2026-10-12: [Publish and distribute a plugin](https://code.claude.com/docs/en/plugins/publish), [Publish to the directory](https://claude.com/docs/directory/publish), the [plugin pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist) and the [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy). The portal's own **Validate** run was not done, so the right-hand column is a reading of the checklist.

**Three routes:**

| Route | What it needs | Review |
| ----- | ------------- | ------ |
| Own marketplace (what `.claude-plugin/marketplace.json` already is) | A public GitHub repository | None |
| Anthropic's directory (claude.ai/directory/manage) | A paid claude.ai plan, and a GitHub repository that is public before the listing goes live | Automated validation and a security scan on every version, and a person reviews a new listing |
| Anthropic's official marketplace (`claude-plugins-official`) | An Anthropic partner contact: it takes no submissions through the portal | Not documented |

**The factory against the checklist:**

| Check | The factory today | Result |
| ----- | ----------------- | ------ |
| A README of at least 40 words in the plugin folder | `plugins/factory/` has none; the README is at the repository root | Blocks |
| A `LICENSE` in the plugin folder, or `license` in `plugin.json` | Both are there | Passes |
| `description`, `author` and `version` set | All three are; `homepage` and `repository`, which the publishing guide also asks for, are not | Passes |
| At most 512 files, text or images only, each under 256 KiB | 94 files, text only, the largest is 123 KB | Passes |
| Readable source, not compiled, packed or minified code | `dist/` holds minified bundles of about 100 KB that the hooks run | Held for a reviewer |
| Hook scripts the validator can follow, or the plugin at the root of its own repository | The plugin is in `plugins/factory/`, and its hooks run bundled JavaScript through `bun` | Held for a reviewer |
| No package launcher, lockfile or registry settings in the plugin folder | None of them are there | Passes |
| A name that isn't generic, taken or confusable with a known brand | `factory` is a generic word, and a product called Factory Droid exists (Superpowers lists it as a host) | Possibly held; only the portal can say |
| The README describes everything the plugin runs, sends or fetches | The README at the root doesn't describe what the hooks run | To write |

"Held for a reviewer" is not a rejection: the version waits for a person to read it, and the scan can raise the same hold on every version.

The policy adds that software which collects user data or connects to a remote service needs a privacy policy link (3A), and that every listing needs verified contact information and a support channel (3B), documentation (3C), at least three example prompts or use cases (3E) and ongoing maintenance (3G).

## Comparison

Facts from the projects' own repositories and documentation, read on 2026-10-12. Stars indicate popularity, not quality.

| Project | What it is | Licence | Stars | Latest release | Hosts |
| ------- | ---------- | ------- | ----- | -------------- | ----- |
| **factory** (this) | Conventions, checkups, architecture register, model routing, autonomy levels, ADRs, toolbox | MIT | private | none | Claude Code |
| [Superpowers](https://github.com/obra/superpowers) | Development methodology as skills: brainstorm, spec, plan, subagent-driven build with review, finish a branch. Version 7 rebuilt brainstorming to size the process to the request: do it, agree it in chat, or write a design | MIT | 298k | v7.0.0 (2026-10-10) | 16, incl. Anthropic's official marketplace |
| [Spec Kit](https://github.com/github/spec-kit) | Three processes: spec-driven development (constitution, specify, plan, tasks, implement, converge), and bug fixing and idea assessment as bundled extensions; about 180 community extensions | MIT | 141k | v1.1.3 (2026-10-09) | about 40 |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | Living specs, plus per-change proposals that are archived when done; built for brownfield | MIT | 72k | v1.14.1 (2026-10-06) | 30+ |
| [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | Role-based agile workflows (PM, architect, dev, test architect), sized to the change. Version 7 is in preview alpha, with a release date of 2026-10-16 in its README | MIT + trademark notice | 54k | v6.12.2 (2026-10-11) | skill-capable tools, Claude Code and Codex marketplaces |
| [Kiro](https://kiro.dev/docs/specs/) | Agentic IDE and CLI with specs, steering files and hooks | proprietary, $0–200/month | n/a | n/a | its own environment |
| [Anthropic's AI-native SDLC playbook](https://claude.com/blog/the-ai-native-sdlc-playbook) | Guidance: Plan, Design, Build, Test, Deploy, Maintain, each with an artifact and a human gate; governance as code | documentation | n/a | 2026-08-21 | Claude |
| [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) | 36 skills: brainstorm, plan, work, review, then write the learning down | MIT | 25k | v3.30.5 (2026-10-11) | 14 |
| [Agent OS](https://github.com/buildermethods/agent-os) | Discover and deploy a codebase's standards, shape specs | MIT | 5.5k | v3.0.0 (2026-01-20) | several |
| [ECC](https://github.com/affaan-m/ECC) | Large agent harness: agents, skills, hooks, memory, a security scanner (AgentShield) | MIT | 278k | v2.2.3 (2026-10-01) | several |

Since 2026-09-30: no project in the comparison was archived, and none was added. The two community implementations of the playbook (bashebr/ai-native-sdlc, 78 stars; jsnkle/ai-native-sdlc, 1 star) are small and both MIT; they stay out.

**Coverage by dimension.** ✓ covered, ~ partial, ✗ not covered. This is an interpretation of the facts above; projects read only at README level are less certain. No cell changed in the 2026-10-12 refresh.

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
- **Migrations that keep behaviour, and tests written apart from the code** (ADR 0062, 0063): a behaviour test that passes on the old code and then on the new, a test agent that never sees the implementation, and a review that breaks the code to see each test fail. No equivalent turned up in the READMEs read; this has not been checked in depth.

## Where it lags

- **The delivery stages are young:** used on three changes, all in this repository, which is small and has no users, database or UI. How they hold up in an existing application is still unknown, and the arbiter has never had to rule.
- **Reach:** Claude Code only; a local install that needs Bun. The leaders run on 14 to 40 hosts and install with one command.
- **Packaging:** no releases, changelog, walkthrough or community channel, and no README in the plugin folder, which Anthropic's directory requires.
- **An opinion, not a methodology:** the conventions are one person's taste (TigerStyle-inspired, TypeScript-first). That's a strength for some users and a narrow audience for others.
- **No evals** yet, and the autonomy levels aren't enforced by hooks yet.

## Not verified

- Kiro's use of EARS, its hook details, autonomy modes and security features: its specs page (read 2026-10-12) names `requirements.md`, `design.md` and `tasks.md` and says nothing on these.
- Adoption beyond stars (downloads, contributors).
- Whether other projects' review gates have any enforcement beyond prompts.
- Whether other projects separate the agent that writes the tests from the one that writes the code (Superpowers' subagent-driven development, Spec Kit's implement and converge).
- The portal's own validation result for the factory, the Software Directory Terms (not read), and how long a review takes (Anthropic says it isn't fixed).
- The two community implementations of the playbook, beyond their size and licence.

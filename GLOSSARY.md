# Glossary

Terms used in this repository, explained for a programmer who is new to AI coding agents and to some of the practices here. Each entry says what the term means in general and, under **Here**, where it shows up in this repository.

## Claude Code and AI agents

**Agent (coding agent).** An AI model that doesn't just answer, but works: it reads files, runs commands, edits code and checks the result, in a loop, until a task is done. Claude Code is such an agent.

**Claude Code.** Anthropic's coding agent, used from the terminal, an IDE or the desktop app. Everything in this repository is built on it. *Here:* it's the one proprietary exception to the license policy (ADR 0035), because it's the platform itself.

**Session.** One conversation with Claude Code, from start to `/clear` or exit. What the agent knows during a session is its **context**.

**Context (context window).** Everything the model can "see" at once: instructions, the conversation, file contents it read. It's limited in size, measured in **tokens** (pieces of words). When a long session gets close to the limit, older parts are summarised (**compaction**). *Here:* why skills load on demand, and why checkups run in subagents with a fresh context.

**Token.** The unit a model reads and writes; roughly three quarters of a word. Cost and context size are counted in tokens. *Here:* RTK exists to save tokens.

**`CLAUDE.md`.** A Markdown file Claude Code loads into every session in a project (and a personal one in `~/.claude/`). It holds instructions for the agent. *Here:* the repository's `CLAUDE.md` describes how to work on the plugin.

**Skill.** A folder with a `SKILL.md`: instructions for one kind of task. Only its short description is always in context; the full text is loaded when a task matches, or when you type its name as a command. *Here:* all skills are listed in `plugins/factory/CATALOG.md` (ADR 0013).

**Frontmatter.** The block between `---` lines at the top of a Markdown file, in YAML, with fields like `name` and `description`. Claude Code reads a skill's frontmatter to know when to use it.

**Slash command.** Typing `/name` to run a skill directly. Plugin skills are prefixed with the plugin's name: `/factory:checkup`.

**Plugin.** A package of skills, agents, hooks and other extensions that can be installed into Claude Code. *Here:* `plugins/factory/` is the plugin.

**Marketplace.** A catalogue of plugins that Claude Code can install from, either a folder on disk (local) or a Git repository. *Here:* this repository is a marketplace, installed locally (ADR 0024, 0026).

**Hook.** A command Claude Code runs automatically at a moment in its lifecycle: `SessionStart` (a session begins), `PreToolUse` (before a tool runs), and others. *Here:* the plugin's session-start hooks add the conventions, the model routing, and the checkup and toolbox reminders (`plugins/factory/hooks/hooks.json`). RTK's hook rewrites shell commands.

**Subagent.** A separate agent the main agent starts for a part of the work, with its own fresh context and its own model. It returns only its result, so the main conversation stays small. *Here:* every checkup runs in one.

**Task agent.** *Here:* a subagent generated per task type in `models.json` (`factory:tasks:code-small`, `factory:tasks:review`, …), carrying that type's default model and effort (ADR 0015).

**Model alias.** A short name like `opus`, `sonnet`, `haiku` or `fable` that points to the current model of that family. Aliases move to a newer model when Claude Code is updated (ADR 0021).

**Effort.** How much thinking a model spends on a response: `low` … `max`. More effort is slower and more expensive, but more careful. *Here:* set per task type in `models.json`.

**MCP server (Model Context Protocol).** A small program that gives an agent extra tools or data, e.g. access to a database or an issue tracker, through a standard protocol.

**Git worktree.** A second working folder for the same Git repository, on another branch, so two tasks can work side by side without touching each other's files. *Here:* every checkup runs in its own worktree under `.claude/worktrees/` (ADR 0042); planned for the build stage too.

## The factory

**Software factory.** A pipeline that turns ideas into shipped software through fixed stages, each with clear inputs, outputs and checks. Some factories are plugins for an agent tool; others have their own **runtime**, an orchestrator that runs agents unattended. *Here:* a plugin, with Claude Code as its runtime and the owner in the loop (ADR 0040); the stages are planned in `TODO.md`.

**Autonomy level.** *Here:* how much Claude decides without asking: `guided` (the owner decides), `trusted` (Claude decides within the conventions) or `autonomous` (Claude runs the work end to end, the owner reviews afterwards). Set per project in `.claude/factory.json`, per session with `/factory:autonomy` (ADR 0044).

**Convention.** A rule for how code is written. *Here:* the always-on ones are in `plugins/factory/conventions/core.md`, added to every session; the detailed ones are `code-*` skills.

**Checkup.** A recurring review of one aspect of a project (security, dependencies, docs, …), run on a schedule by an agent (ADR 0010).
- **Schedule:** `docs/checkups/checkups.json`, which says which checkups run how often, and their **priority** (`urgent`, `normal`, `quiet`; ADR 0030).
- **Protocol:** the rules every checkup follows (`plugins/factory/checkups/protocol.md`).
- **Report:** what a run found, in `docs/checkups/<name>/<date>.md`. The newest report's date is the checkup's last run.
- **Runner:** `/factory:checkup`, which shows what's due and starts the checkups.
- **Override:** a project's own version of a checkup, which replaces the plugin's (ADR 0023).
- **Defaults:** each checkup skill declares a default interval and priority; the schedule only overrides them where the owner wants to (ADR 0049).
- **Declined:** a checkup the owner opted out of, listed under `declined` in the schedule, so the runner doesn't suggest it again (ADR 0037).
- **Interactive checkup:** one that runs in the main session with the owner, because it needs their answers, e.g. `monitoring` (ADR 0037).

**Monitoring checkup.** *Here:* a daily checkup that makes sure the owner looks at every monitoring service a project uses, like SonarQube (code quality scanning), Veracode and Snyk (security scanning) or Sentry (error tracking), through a short question set (ADR 0037).

**Architecture checkup and register.** *Here:* a checkup that asks whether a project's architecture still fits, per explicitly scoped unit (an app or package, the boundary between two, or the whole repository), and turns each candidate into a proposed decision, including "keep it as it is". The register, `docs/architecture/`, holds the map of units, the known debt with its status and when to reconsider it, a log of workarounds, and the *drivers*: the requirements, plans and load the architecture has to serve. A changed driver reopens the decisions that depend on it (ADR 0045, 0046).

**Hotspot and change coupling.** From git history: a *hotspot* is a file that changes often and is complex; *change coupling* means files that keep changing in the same commits. Both point to where an architecture hurts.

**Strangler fig.** Replacing part of a system step by step, with the old and new side by side behind a stable interface, until the old part can be removed. The alternative to a big-bang rewrite.

**Readiness.** *Here:* `docs/readiness.md`, which compares the factory with alternatives such as Superpowers, Spec Kit and OpenSpec, and tracks the criteria for publishing it. The `readiness` checkup keeps it current (ADR 0050).

**Conventions checkup.** *Here:* a checkup of this repository that re-reads the sources of the owner's conventions, looks for better practices, and checks the conventions for contradictions. It only proposes (ADR 0039).

**Model routing.** Choosing which model does which kind of work. *Here:* `plugins/factory/models.json` (ADR 0014).

**Toolbox.** *Here:* the list of trusted tools and plugins in `plugins/factory/toolbox.json`, with a security record for each, and `/factory:toolbox` (ADR 0033).

**Spec-driven development.** Writing down what to build, step by step in Markdown files, before an agent writes code:
- `intent.md`: the problem and the goal;
- `spec.md`: exactly what should happen;
- `plan.md`: how;
- `tasks.md`: in what order.

*Here:* planned for the factory's first stages.

**Triage.** Sorting a task by type, size and risk, to choose how much process it needs. *Here:* planned as stage 0 of the factory, choosing a quick, standard or full route.

**Generated file.** A file produced by a script from other files, never edited by hand. *Here:* `bun run generate` writes the catalog, the task agents, the bundles and the license files; `bun run validate` checks they're current.

**Bundle.** One self-contained JavaScript file with all the code it needs, including libraries. *Here:* `plugins/factory/dist/*.js`. An installed plugin only has its own folder, so its scripts are bundled (ADR 0020).

## Engineering practices

**ADR (architecture decision record).** A short document recording one decision: the context, the decision, and its consequences. Accepted ADRs aren't rewritten; a new ADR supersedes an old one. *Here:* `docs/decisions/` (ADR 0001).

**Assertion (`assert`).** A check in the code that something that must be true is true, failing loudly when it isn't. It catches bugs where they happen, not three steps later. *Here:* `lib/assert.ts`.

**Pair assertion.** Checking the same property in two places: where data is written and where it is read. A bug on either side is then caught close to its cause. *Here:* `bun run generate` writes the generated files and `bun run validate` checks them (ADR 0038).

**Fail fast.** Stopping at the first point that can see a problem, loudly, instead of passing a wrong value on. Its counterpart, *fail safe*, falls back to the safe side where failing would do more harm. *Here:* `code-safety`, ADR 0048.

**Negative space programming.** Stating in code what must *not* happen (with assertions), not only what should. A term from TigerStyle.

**Boundary (trust boundary).** The edge where data enters the program from outside: a request, a file, an environment variable, a database row, a model's output. *Here:* data is parsed at the boundary and trusted after it.

**Parse, don't validate.** Instead of checking data and passing the same untyped value on, turn it into a typed value at the boundary, or reject it. The types then guarantee the data is valid everywhere after.

**Schema.** A description of the shape data must have (fields, types, limits), used to parse it. *Here:* written with **Zod**, a schema library, through **Standard Schema**, a common interface that several schema libraries share (ADR 0020).

**Bounds.** Limits on how big (upper bound) or small (lower bound) something may be: loop iterations, input sizes, retries, waits. Crossing one fails loudly. *Here:* ADR 0032 and 0034, and the `code-safety` skill, after NASA/JPL's "Power of 10" rules and TigerStyle.

**Nursery rule.** A lint rule that Biome still considers experimental: it may change or be renamed in a minor release before it becomes stable. *Here:* `noFloatingPromises` and `noMisusedPromises` (ADR 0038).

**Cancellation.** Being able to stop work that's no longer needed (a user navigated away, a timeout passed). In JavaScript through an `AbortSignal`, in Go through a `context.Context`. *Here:* ADR 0012 and the `code-cancellation` skill.

**Declarative vs imperative.** Declarative code says *what* result you want (`files.filter(isSource).map(read)`); imperative code says *how*, step by step, with changing variables (a `for` loop pushing into an array). *Here:* declarative is the default (ADR 0022).

**TSDoc.** The standard for documentation comments in TypeScript (`/** … */`), with tags like `@param`, `@returns` and `@example`.

**Doctest.** Running the code examples inside documentation as tests, so they can't go out of date. *Here:* `bun run doctest` (ADR 0016).

**Lint, linter.** A tool that checks code for mistakes and style problems without running it. *Here:* Biome, which also **formats** code (lays it out consistently).

**Type check.** Checking that values are used according to their types, before running the code. *Here:* `tsc` with a very strict configuration (ADR 0004).

**Git hook.** A script Git runs at a moment like a commit or a push. *Here:* formatting before a commit, all checks before a push (ADR 0006, 0009).

**CI (continuous integration).** Running the checks automatically on a server for every push and pull request. *Here:* GitHub Actions runs `bun run check` (ADR 0028).

**Monorepo and workspaces.** A *monorepo* holds several packages or apps in one repository. *Workspaces* (in Bun, npm, pnpm or Yarn) are how a package manager links them: each package has its own `package.json` and exposes only what it exports, and they can depend on each other without being published. *Here:* one package so far; whether `lib/` should become workspace packages is ADR 0047.

**Semver (semantic versioning).** Version numbers as `major.minor.patch`: a patch fixes, a minor adds without breaking, a major may break.

## Testing

**Unit test.** Tests one function or module on its own.

**Integration test.** Tests several modules working together with their real collaborators.

**Component test.** Tests a UI component the way a user uses it: finding elements by their role and label, clicking and typing. *Here:* with **Testing Library**.

**End-to-end (E2E) test.** Tests a whole flow in a real browser against the running application. *Here:* with **Playwright**.

**axe.** A tool that checks a page or component against accessibility rules (WCAG, the Web Content Accessibility Guidelines). *Here:* the `code-accessibility` skill.

**Equivalence classes and boundary values.** Grouping inputs that should behave the same and testing one of each group, plus the values at and just past every limit. The systematic way to find edge cases (`code-testing`).

**Property-based test.** Instead of listing example inputs, stating a property that must always hold ("sorting twice gives the same result") and letting a tool generate hundreds of inputs to try to break it.

**Mutation testing.** Making small deliberate changes (mutations) to the code and checking that some test fails. It measures whether tests actually catch bugs, which coverage can't.

**Coverage.** Which lines of code the tests ran. It shows what isn't tested, but not whether what is tested is tested well.

**Flaky test.** A test that sometimes passes and sometimes fails without any code change, usually because of timing, order or shared state. *Here:* treated as a bug.

**Mock.** A stand-in for a real dependency in a test. *Here:* only for the outer edges (network, clock), never for the project's own code.

## Licenses

**Open source.** Software whose license lets anyone use, study, change and share it.

**Permissive license.** An open-source license with minimal conditions, mostly keeping the copyright notice: MIT, Apache-2.0, BSD, ISC. *Here:* the only kind allowed (ADR 0035).

**Copyleft.** An open-source license that requires changed or combined versions to use the same license (GPL, AGPL, MPL). *Here:* not allowed, because it places obligations on the owner's own code.

**Source-available.** Code you can read but not freely use, e.g. BSL or SSPL. Not open source.

**SPDX.** Standard short identifiers for licenses (`MIT`, `Apache-2.0`) and expressions combining them (`MIT OR Apache-2.0`). *Here:* how licenses are checked.

**Third-party notices.** The license texts of other people's code included in what you distribute. *Here:* `plugins/factory/THIRD-PARTY-NOTICES.md`, generated (ADR 0027).

## Databases

**Constraint.** A rule the database enforces on every write: `NOT NULL` (a value is required), `UNIQUE`, a **foreign key** (the value must exist in another table), or a `CHECK` (a condition, like a range).

**Index.** A lookup structure that makes finding rows by a column fast, at the cost of slightly slower writes.

**Migration.** A versioned script that changes the database schema (or data) from one version to the next.

**Expand, migrate, contract.** Changing a live database without downtime: first add the new thing, then move data and code to it, and only later remove the old thing.

**N+1 query.** Running one query for a list and then one more query per item, instead of loading everything in one or two queries. Slow as the list grows.

**Keyset pagination.** Paging through results by remembering the last row's key (`WHERE id > 42 LIMIT 20`) instead of skipping rows with `OFFSET`, which gets slower and can skip or repeat rows when data changes.

**`STRICT` table (SQLite).** A table that refuses values of the wrong type. By default SQLite accepts almost anything in any column.

*Here:* all of these are in the `code-sql` skill (ADR 0036).

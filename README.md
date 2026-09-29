# Conglomerate

A Claude Code plugin marketplace that houses **factory**: a personal, opinionated software factory. It turns one developer's conventions and habits into rules the agent follows in every project, and keeps those projects healthy over time.

## What the factory gives you

Most AI coding factories focus on getting from an idea to code. This one starts at the other end: **how code stays good**, in every project, for as long as it lives.

- **Conventions that are always on, and enforced.** A compact set of rules is loaded into every session: readability first, flat code, one named condition per `if`, bounds on everything (after NASA/JPL's "Power of 10" and TigerStyle), cancellation, parsing external data with schemas, explicit APIs, documentation with tested examples. The details live in skills that load when they're relevant (`code-react`, `code-testing`, `code-styling`, `code-safety`, …). The plugin's own code is held to all of it, by a strict TypeScript config, lint rules and CI.
- **Recurring checkups that keep projects healthy.** Sixteen generic checkups cover security, dependencies, new language and framework features, test coverage, code quality, unused code, documentation drift, licenses, TODOs, accessibility, performance, SEO, the agent setup, repository health, and a retrospective of the checkups themselves. Projects add their own (legal, data quality, …) or override the generic ones.
  - Each checkup runs on a schedule, in its own subagent and on its own branch.
  - It fixes what's small and safe, and hands the rest over as a pull request with a report.
  - Urgency levels decide how insistently a due checkup is brought up.
- **The right model for each task.** Work is routed by task type to the model and effort level that fit it: a small model for mechanical edits, a strong one for reviews and planning. The agent may override the route with a stated reason, and escalates when a task turns out bigger than expected.
- **A toolbox you can trust.** The tools and plugins you rely on are listed with a security record (source, license, permissions). A missing one is reported at session start, and nothing is installed without your confirmation.
- **Every decision is written down.** Each convention and design choice has an architecture decision record in [`docs/decisions/`](docs/decisions/), so humans and agents can see *why*, not just *what*.
- **It checks itself.**
  - Every documentation example runs as a test.
  - Generated files (skill catalog, task agents, bundles, license notices) are rebuilt and compared on every push.
  - The factory runs its own checkups on this repository.

**In progress:** the delivery stages themselves: triage of each task into the right route, intent and specification, planning, building with fresh subagents per task, review, and finishing a branch. See [`TODO.md`](TODO.md).

## Install

This repository is a Claude Code marketplace. From a local clone:

```
/plugin marketplace add /path/to/conglomerate
/plugin install factory@conglomerate
```

The plugin needs [Bun](https://bun.sh) on the machine; its hooks and skills run Bun scripts. All skills are listed in [`plugins/factory/CATALOG.md`](plugins/factory/CATALOG.md).

## Develop

```sh
bun install         # install dev dependencies and activate git hooks
bun run check       # run all quality gates (also runs on git push and in CI)
                    # staged files are auto-formatted on git commit
bun run generate    # regenerate the catalog, task agents, bundles and license files
bun run typecheck   # type-check
bun run lint        # lint + format check (bun run lint:fix to fix)
bun test            # run tests
bun run doctest     # check TSDoc and run every @example
bun run validate    # validate manifests, skills and generated files
claude --plugin-dir plugins/factory   # try the plugin from source
```

Licensed under [MIT](LICENSE). Third-party code in the plugin's bundles is listed in [`plugins/factory/THIRD-PARTY-NOTICES.md`](plugins/factory/THIRD-PARTY-NOTICES.md).

# Conglomerate

A Claude Code plugin marketplace that houses **factory**: a personal, opinionated software factory. It turns one developer's conventions and habits into rules the agent follows in every project, and keeps those projects healthy over time.

## What the factory gives you

Most AI coding factories focus on getting from an idea to code. This one does that too, but starts at the other end: **how code stays good**, in every project, for as long as it lives.

- **Conventions that are always on, and enforced.** A compact set of rules is loaded into every session: readability first, flat code, one named condition per `if`, bounds on everything (after NASA/JPL's "Power of 10" and TigerStyle), cancellation, parsing external data with schemas, explicit APIs, documentation with tested examples. The details live in skills that load when they're relevant (`code-react`, `code-testing`, `code-styling`, `code-safety`, …). The plugin's own code is held to all of it, by a strict TypeScript config, lint rules and CI.
- **Recurring checkups that keep projects healthy.** Eighteen generic checkups cover security, dependencies, new language and framework features, test coverage, code quality, unused code, documentation drift, licenses, TODOs, accessibility, performance, SEO, the agent setup, repository health, the architecture (per app or package, with a recorded decision either way), a daily look at the project's monitoring (SonarQube, Sentry, …), and a retrospective of the checkups themselves. Projects add their own (legal, data quality, …) or override the generic ones.
  - Each checkup runs on a schedule, in its own subagent and on its own branch. The monitoring checkup runs with you instead, asking questions only a real look can answer.
  - You can decline a checkup per project, and it won't be suggested again until you opt back in.
  - It fixes what's small and safe, and hands the rest over as a pull request with a report.
  - Urgency levels decide how insistently a due checkup is brought up.
- **A route from idea to merged code.** Every task starts with triage, which proposes a route through fixed stages (intent, spec, plan, tasks, build, review, finish) with an autonomy level per stage, and waits for your go-ahead. Along the route:
  - specs have numbered acceptance criteria in EARS form (a fixed sentence pattern, see the [glossary](GLOSSARY.md));
  - every criterion is traced to a task and to the test that proves it;
  - a different agent writes those tests than the one that writes the code;
  - a separate agent reviews the result and breaks the code on purpose to see each test fail;
  - scripts check each stage's document before the next one starts.

  Security is on by default: every spec says who may use what it describes, and a missing authentication or authorisation check can only ship on your explicit say.
- **You choose how much it decides.** Three autonomy levels (guided, trusted, autonomous), per project or per session. Some decisions stay yours at every level: the conventions, the architecture, anything destructive.
- **The right model for each task.** Work is routed by task type to the model and effort level that fit it: a small model for mechanical edits, a strong one for reviews and planning. The agent may override the route with a stated reason, and escalates when a task turns out bigger than expected.
- **A toolbox you can trust.** The tools and plugins you rely on are listed with a security record (source, license, permissions). A missing one is reported at session start, and nothing is installed without your confirmation.
- **Every decision is written down.** Each convention and design choice has an architecture decision record in [`docs/decisions/`](docs/decisions/), so humans and agents can see *why*, not just *what*.
- **It checks itself.**
  - Every documentation example runs as a test.
  - Generated files (skill catalog, task agents, bundles, license notices) are rebuilt and compared on every push.
  - The factory runs its own checkups on this repository.

**Still to do:** use the delivery stages on a project other than this repository, and the packaging a public release needs. See [`TODO.md`](TODO.md) and [`docs/readiness.md`](docs/readiness.md).

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

New to some of the terms here? See the [glossary](GLOSSARY.md).

Licensed under [MIT](LICENSE). Third-party code in the plugin's bundles is listed in [`plugins/factory/THIRD-PARTY-NOTICES.md`](plugins/factory/THIRD-PARTY-NOTICES.md).

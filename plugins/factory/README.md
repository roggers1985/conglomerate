# factory

A Claude Code plugin that holds one developer's coding conventions and turns them into rules the agent follows in every project, a route from idea to merged code, and recurring checkups that keep projects healthy.

## What it does

- **Always-on conventions.** A compact set of rules is added to every session: readable, flat code, bounds on everything, cancellation, parsing external data with schemas, explicit APIs and documentation with tested examples. The details load as `code-*` skills when they are relevant.
- **A route for each task.** Triage proposes stages (intent, spec, plan, tasks, build, review, finish) with an autonomy level per stage, then waits for your go-ahead. Scripts check each stage's document before the next stage starts.
- **Recurring checkups.** Generic checkups for security, dependencies, test coverage, code quality, documentation drift, licenses and more. Each runs in its own subagent and branch, and hands over a pull request with a report.
- **You choose how much it decides.** Three autonomy levels: `guided`, `trusted` and `autonomous`. Conventions, architecture and anything destructive stay yours at every level.

## Install

From a marketplace that lists it:

```
/plugin install factory@<marketplace>
```

The plugin needs [Bun](https://bun.sh) on the machine, because its hooks and skills run Bun scripts. They are bundled in `dist/`.

## Commands

| Command | What it does |
| --- | --- |
| `/factory:start` | Triage a task and propose its route. |
| `/factory:checkup` | Show which checkups are due and run them. |
| `/factory:autonomy` | Show or change how much the agent decides without asking. |
| `/factory:toolbox` | Show missing tools and plugins, and propose how to install them. |

## More

- [`CATALOG.md`](CATALOG.md) lists every skill.
- The decisions behind the plugin are in [`docs/decisions/`](../../docs/decisions/) in the repository.
- [`LICENSE`](LICENSE) is MIT. Third-party code in the bundles is listed in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

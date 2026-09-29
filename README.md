# Conglomerate

A Claude Code plugin marketplace that houses **factory**, a software factory plugin. It is under construction and currently contains only boilerplate.

## Install

```
/plugin marketplace add <owner>/conglomerate
/plugin install factory@conglomerate
```

## Develop

Requires [Bun](https://bun.sh).

```sh
bun install         # install dev dependencies and activate git hooks
bun run check       # run all quality gates (also runs on git push)
                    # staged files are auto-formatted on git commit
bun run generate    # regenerate CATALOG.md, task agents and bundles (dist/)
bun run typecheck   # type-check
bun run lint        # lint + format check (bun run lint:fix to fix)
bun test            # run tests
bun run doctest     # check TSDoc and run every @example
bun run validate    # validate the manifests
claude --plugin-dir plugins/factory   # try the plugin locally
```

All skills are listed in [`plugins/factory/CATALOG.md`](plugins/factory/CATALOG.md).
Licensed under [MIT](LICENSE). Third-party code in the plugin's bundles is listed in [`plugins/factory/THIRD-PARTY-NOTICES.md`](plugins/factory/THIRD-PARTY-NOTICES.md).
Design decisions are recorded in [`docs/decisions/`](docs/decisions/).

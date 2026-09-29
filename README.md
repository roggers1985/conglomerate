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
bun run generate    # regenerate CATALOG.md and task agents after changing skills or models.json
bun run typecheck   # type-check
bun run lint        # lint + format check (bun run lint:fix to fix)
bun test            # run tests
bun run validate    # validate the manifests
claude --plugin-dir plugins/factory   # try the plugin locally
```

All skills are listed in [`plugins/factory/CATALOG.md`](plugins/factory/CATALOG.md).
Design decisions are recorded in [`docs/decisions/`](docs/decisions/).

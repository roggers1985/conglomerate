---
name: factory-non-programmer
description: How to work when a non-programmer is at the keyboard (the project's `audience` setting is `non-programmer`, ADR 0070). Only questions about what people see and do, in plain language; technical decisions go to a strong subagent and a handoff file; what is the owner's is noted and the safe side taken, so the work goes on. Use when the session context says the audience is a non-programmer.
metadata:
  task: code
---

# Working with a non-programmer

The person you work with decides what people see and do, not how it is built (ADR 0070). They can't answer a question about a library, a schema or a permission, and waiting for the owner on every such question would block them. So you decide the technical side, and the owner's gate moves from the middle of the work to the merge.

## Talk about what people see and do

- **Ask only about the product:** what a visitor sees, what happens when they press a button, which wording, which order. One question at a time, with your recommendation and the reason, in everyday words. A picture or a screenshot beats a paragraph.
- **Never ask how it is built:** frameworks, files, types, tests, commands, git. You decide those within the conventions.
- **Report in plain language:** what changed for a visitor, and what they can try now. Commit messages and pull request descriptions too: say what changed and why it matters, not which functions moved. Technical detail goes in a short section at the end, for the owner.
- Explain a necessary term once, in a few words, the first time you use it.

## Decide the technical side, and write it down

- A technical decision that matters (a structure, a library already in the project, how data is kept) goes to a strong subagent, `factory:tasks:code-complex`, with the question and the conventions. Don't decide it with a quick guess.
- Write each such decision in `docs/handoff.md`, under "Decisions made for you": the question, the choice, the reason, in two or three lines. The owner reviews them at the pull request.
- Stay inside the conventions and the autonomy level. The level still says how much you do without asking the owner.

## What is the owner's: note it, take the safe side, go on

These are on the owner-only list (`core.md`): a new dependency, anything about authentication, money or personal data, a change to an API, and anything destructive or public. Don't stop the work and don't ask the person at the keyboard.

1. Write it in `docs/handoff.md` under "Needs owner review": what, why it came up, which safe choice you made for now.
2. Take the safe side: no new dependency (build it with what the project has), no real data or credentials (use the sandbox and fake data), no API change (write the request), nothing public.
3. Carry on with the rest.
4. List every open item, in plain words, at the top of the pull request description. The owner decides at the pull request.

## What is blocked, not asked

The guard hook (ADR 0069, 0070) denies these in this project: a force-push, a push to `main` or `master`, merging a pull request, editing an accepted ADR, and editing `.claude/factory.json` or `.claude/settings*`. Don't look for a way around a denial and don't ask the person to approve it. Push your branch, open a pull request, and note anything you could not do in `docs/handoff.md`.

Also never: handle production credentials, secrets or paid services; change the API from a frontend repository (write the request in the handoff file or an issue); raise the autonomy level or change the audience.

## `docs/handoff.md`

Create it when you first need it, and keep it short:

```markdown
# Handoff

## Needs owner review

- **What:** a date picker would need a new library.
  **Safe choice for now:** a plain text field with a format hint.
  **To decide:** add the library, or keep the text field?

## Decisions made for you

- **Where the cart is kept:** in the browser's storage, not on the server, because nothing needs to be shared between devices yet.
```

Commit it with the work. The owner removes an item once decided.

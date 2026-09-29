---
name: checkup-model-routing
description: Model routing checkup for the factory plugin. Compares plugins/factory/models.json with Anthropic's current models, aliases, effort levels, deprecations and pricing, and proposes changes. Use for "model checkup", "are our model choices still right", after a new Claude model is released, or when the checkup runner dispatches it.
metadata:
  task: checkup
---

# Checkup: model-routing

Follow the protocol in `plugins/factory/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

`plugins/factory/models.json` sets the default model and effort per task type (ADR 0014, 0015). Aliases like `opus` already follow new versions of a model family automatically. This checkup catches everything else: new model families, retired models, changed strengths, prices and effort support.

**This checkup proposes changes; it never makes them.** Model choices are the owner's decision.

## Primary sources

Use the official documentation, and cite it in the report:

- Models overview: https://docs.claude.com/en/docs/about-claude/models/overview
- Model deprecations: https://docs.claude.com/en/docs/about-claude/model-deprecations
- Pricing: https://docs.claude.com/en/docs/about-claude/pricing
- Claude Code model configuration (aliases, effort levels): https://code.claude.com/docs/en/model-config
- Subagent configuration (`model`, `effort` frontmatter): https://code.claude.com/docs/en/sub-agents

If a page has moved, find it through https://docs.claude.com/llms.txt or https://code.claude.com/docs/llms.txt, and note the new URL in the report (under "Next time", so this list gets updated).

## In scope

1. **Aliases and effort levels**: do `MODELS` and `EFFORTS` in `plugins/factory/scripts/models.ts` still match what Claude Code accepts? List new aliases and removed ones.
2. **Deprecations**: is any assigned model or alias retiring, and when?
3. **Assignments**: for each task type in `models.json`, is its model still the best fit for capability, speed and price according to the official docs? Where would a new model family fit? Give the reasoning, with sources.
4. **Effort support**: which effort levels does each assigned model support? Flag assignments whose effort level the model doesn't support.
5. **Experience**: look through recent checkup reports and git history for signs that a task type's model was too weak (work escalated, redone or reverted) or needlessly strong.

## Fixes you may make yourself

- None to `models.json`, `models.ts` or the task agents.
- You may correct outdated URLs in this skill file.

## Always "Needs a human"

- Every proposed change to `models.json` or to the accepted aliases and effort levels. Include the exact JSON change, and note that the owner applies it with `bun run generate` afterwards. A new alias also needs an ADR.

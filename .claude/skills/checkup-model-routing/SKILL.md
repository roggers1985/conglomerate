---
name: checkup-model-routing
description: Model routing checkup for the factory plugin. Compares plugins/factory/models.json with Anthropic's current models, aliases, effort levels, deprecations and pricing, and proposes changes. Use for "model checkup", "are our model choices still right", after a new Claude model is released, or when the checkup runner dispatches it.
metadata:
  intervalDays: 30
  priority: normal
  task: checkup
---

# Checkup: model-routing

Follow the protocol in `plugins/factory/checkups/protocol.md` (branch, hard rules, report, commit). This file only defines the scope.

`plugins/factory/models.json` sets the default model and effort per task type (ADR 0014, 0015). Aliases like `opus` already follow new versions of a model family automatically. This checkup catches everything else: new model families, retired models, changed strengths, prices and effort support.

**This checkup proposes changes; it never makes them.** Model choices are the owner's decision.

## Primary sources

Use the official documentation, and cite it in the report:

- Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Model deprecations: https://platform.claude.com/docs/en/about-claude/model-deprecations
- Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Claude Code model configuration (aliases, effort levels): https://code.claude.com/docs/en/model-config
- Subagent configuration (`model`, `effort` frontmatter): https://code.claude.com/docs/en/sub-agents

If a page has moved, find it through https://platform.claude.com/llms.txt or https://code.claude.com/docs/llms.txt, and note the new URL in the report (under "Next time", so this list gets updated).

## In scope

1. **Aliases and effort levels**: do `MODELS` and `EFFORTS` in `plugins/factory/scripts/models.ts` still match what Claude Code accepts? List new aliases and removed ones.
2. **Claude Code version**: aliases only move to a newer model once Claude Code itself is updated (ADR 0021). Compare `claude --version` with the version history on the model configuration page, and report which model each alias resolves to *on this machine*. If an update would move an alias to a newer model, propose `claude update` under "Needs a human".
3. **Deprecations**: is any assigned model or alias retiring, and when?
4. **Assignments**: for each task type in `models.json`, is its model still the best fit for capability, speed and price according to the official docs? Where would a new model family fit? Give the reasoning, with sources. A model that Anthropic positions as the step up when the strongest assigned model falls short (currently `fable`) is the escalation target of ADR 0015, not a default for a task type (ADR 0021). Check that the escalation advice in `renderRoutingContext` (`plugins/factory/scripts/models.ts`) still names the right models.
5. **Effort support**: which effort levels does each assigned model support? Flag assignments whose effort level the model doesn't support.
6. **Experience**: look through recent checkup reports and git history for signs that a task type's model was too weak (work escalated, redone or reverted) or needlessly strong. On the first runs there is little or no history; say so, and move on.

## Fixes you may make yourself

- None to `models.json`, `models.ts` or the task agents.
- You may correct outdated URLs in this skill file.

## Always "Needs a human"

- Every proposed change to `models.json` or to the accepted aliases and effort levels. Include the exact JSON change, and note that the owner applies it with `bun run generate` afterwards. A new alias also needs an ADR.

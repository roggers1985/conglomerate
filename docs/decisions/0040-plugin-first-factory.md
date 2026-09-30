# 40. A plugin-first factory

Date: 2026-09-30

## Status

Accepted

## Context

"Software factory" means different things in different projects. Some are plugins for an agent tool like Claude Code: conventions, skills, hooks and scripts that shape a session the owner starts and follows. Others have their own runtime: an orchestrator, built on the Agent SDK or the API, with a state machine, queues and triggers, that runs agents unattended in the cloud.

The choice follows from a few questions: does the owner sit in the loop or on it, should work start without them, must stage gates be enforced or is guidance enough, how many people and projects use it, and should it work with more than one agent tool.

The owner's answers:
- they want to be in the loop;
- at work they are expected to be online anyway;
- they don't have the budget to run unlimited agents in the cloud, at least not yet.

## Decision

- **The factory is a Claude Code plugin,** with scripts where they add something. It has no runtime of its own: Claude Code is the runtime, and the owner starts and follows every session.
- **Scripts where they add something:** checks that must hold go into scripts rather than prose, such as `validate`, the checkup status, and later stage gates. A hook can then enforce them.
- **State lives in the repository as files:** `TODO.md`, ADRs, checkup reports, and later the stage documents (`intent.md`, `spec.md`, `plan.md`, with the route at the top). An interrupted session can resume from them, and a runtime could pick them up if one is ever added.
- **When to reconsider:**
  - the owner wants work to start without them;
  - more parallel agents are needed than worktrees give;
  - someone else uses the factory;
  - a gate needs enforcement that hooks can't provide;
  - the budget for cloud agents changes.

  The first step would then be the smallest: headless Claude Code with this same plugin, started from CI or a scheduled cloud agent. Only if that falls short would we build a runtime of our own.

## Consequences

- Nothing runs unless the owner opens a session, so due checkups surface at session start. This is accepted: the owner is online while working.
- Cost stays at what an interactive session uses.
- A gate that only exists as an instruction can be skipped by a model. Important gates are therefore turned into scripts over time.
- The factory's strengths are its conventions, checkups and recorded decisions, and those suit a plugin. Its weaknesses, being tied to one tool and having no autonomy, are accepted for now. Supporting Copilot remains a separate open item in `TODO.md`.

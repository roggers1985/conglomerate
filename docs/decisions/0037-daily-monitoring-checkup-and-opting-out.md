# 37. Daily monitoring checkup, and opting out of checkups

Date: 2026-09-29

## Status

Accepted

Amends [ADR-0010](0010-recurring-checkups.md) (interactive checkups and declined checkups). Clarifies [ADR-0035](0035-permissive-open-source-licenses-only.md) (external services).

## Context

The owner wants to look at every monitoring service a project uses at least once every working day: SonarQube, Veracode, Sentry, and others of that kind. Two things were unclear:
- how to know the owner has actually looked, rather than an agent;
- whether a project should be able to opt out of such a checkup, and back in, without being asked again.

## Decision

- **One generic `monitoring` checkup:**
  - it detects which monitoring and scanning services the project uses. These can be code quality and security scanners (SonarQube, Veracode, Snyk, GitHub code scanning, Dependabot alerts), error tracking (Sentry, Bugsnag, Rollbar), or monitoring and uptime (Datadog, New Relic, Grafana). More can be added to its table;
  - it is scheduled with `intervalDays: 1` and `priority: urgent`. Since due checkups only surface when a session starts, that means every day the owner works on the project, first thing.
- **Proof of looking:**
  - where API access already exists (the GitHub CLI, the Sentry MCP server, tokens in the environment), the checkup first summarises what changed since the last run;
  - it then asks the owner a short question set per service that **can only be answered by looking**: a count, a status, or a decision (what gets picked up, what's ignored and why).
- **Interactive checkups:** skills with `metadata.interactive: true` run in the main session with the owner, before the subagent checkups, with no branch, commit or pull request.
- **Local reports:** the monitoring report is written to `docs/checkups/monitoring/<date>.md` as usual, so its date marks the run, but that folder is gitignored:
  - reports can contain production data;
  - a daily report would flood the history.

  Decisions and follow-up work go to the committed task list or issues.
- **Opting out, for every checkup:** the schedule gains an optional `declined` list. Opting out moves a checkup from `checkups` to `declined`, and the runner doesn't suggest it again; opting back in moves it back. A checkup can't be in both lists. The status table shows the declined ones.
- **Licenses:** ADR-0035's policy covers what the owner adds and installs (dependencies, tools, plugins). External services a project already uses, like these monitoring services or GitHub, are outside it. Their SDKs, when installed as dependencies, still have to pass (e.g. Sentry's are MIT).

## Consequences

- In a project with monitoring, the first session of each working day starts with a short look at it. The owner can opt out per project, and back in.
- The daily reports exist only on the machine where the checkup ran. The committed task list carries what matters.
- Monitoring access remains read-only: muting, resolving or accepting findings is always the owner's decision.

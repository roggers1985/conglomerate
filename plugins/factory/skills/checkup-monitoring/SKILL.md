---
name: checkup-monitoring
description: "Daily monitoring checkup, run with the owner in the main session. Detects which monitoring and scanning services the project uses (e.g. SonarQube, Veracode, Sentry, Snyk, GitHub code scanning and Dependabot alerts, Datadog), summarises what changed since the last run where there is API access, and asks the owner a short question set that can only be answered by looking. Use when the runner dispatches it, or when asked to check the project's monitoring, errors or scan results."
metadata:
  intervalDays: 1
  priority: urgent
  task: checkup
  interactive: true
---

# Checkup: monitoring

Follow the protocol in `${CLAUDE_PLUGIN_ROOT}/checkups/protocol.md`, with the three differences below. This file defines the scope.

The goal: **the owner has looked at every monitoring service the project uses, every working day.** Tools can summarise, but only the owner's own look (and decisions) counts. Schedule it with `"intervalDays": 1, "priority": "urgent"`; a checkup is only due when a session starts, so this means "every day you work on this project".

## Differences from the protocol

1. **Interactive, in the main session.** It runs with the owner, not in a subagent: the question set needs them.
2. **No branch, no commit, no pull request.** The daily report is local.
3. **The report stays out of git.** Write it to `docs/checkups/monitoring/<today>.md` as usual (its date marks the run as done), but make sure `docs/checkups/monitoring/` is in the project's `.gitignore` first. Reports can contain production data (error messages, user identifiers, file paths), and a report every day would flood the history. On the first run, propose adding the `.gitignore` entry and commit only that change, with the owner's confirmation.

Decisions and follow-up work don't stay in the local report: they go to the project's task list (`TODO.md` or issues), which is committed.

## 1. Detect what the project uses

Look for signs of each kind of service. Only the ones found are part of today's run.

| Kind | Service | Signs |
|---|---|---|
| Code quality and security scanning | SonarQube / SonarCloud | `sonar-project.properties`, a Sonar step in CI, `sonar.*` settings |
| | Veracode | a Veracode step or config in CI, `veracode.json` |
| | Snyk | `.snyk`, a Snyk step in CI |
| | GitHub code scanning (CodeQL) | a CodeQL workflow in `.github/workflows` |
| | Dependabot alerts | `.github/dependabot.yml`, or open alerts in the repository |
| Error tracking | Sentry | `@sentry/*` or `sentry-sdk` dependencies, `SENTRY_DSN` in `.env.example` |
| | Bugsnag, Rollbar | their SDKs as dependencies |
| Monitoring, logs and uptime | Datadog, New Relic, Grafana, uptime monitors | their agents, SDKs or config files, or monitors named in `CLAUDE.md` |

Also read the project's `CLAUDE.md` for monitoring it names explicitly (dashboards, where the service's project lives). When nothing is found, write a short report saying so, and propose moving `monitoring` to the schedule's `declined` list.

## 2. Gather what changed since the last run

For each detected service, where access exists, summarise what's new since the previous report's date. Never ask for a token to be pasted into the conversation.

- **GitHub code scanning and Dependabot:** `gh api repos/{owner}/{repo}/code-scanning/alerts?state=open` and `…/dependabot/alerts?state=open`.
- **Sentry:** the Sentry MCP server if it's configured, or its API with a token from the environment (`SENTRY_AUTH_TOKEN`).
- **SonarQube / SonarCloud:** the Web API with a token from the environment (`SONAR_TOKEN`): the quality gate status, and new issues by severity.
- **Veracode, Datadog and others:** their APIs or CLIs, only when credentials are already configured.

Without access, skip straight to the questions. Summarise, and never paste raw events, stack traces with user data, or secrets.

## 3. The question set

Ask per detected service, in one short round. Ask questions that **can only be answered by looking** (a number, a status, a choice), not "did you look? yes/no". Where the summary already has the facts, ask the owner to confirm them and decide instead.

- **Error tracking (Sentry, …):** How many new issues since the last run? Is there a new spike or a regression? Which issue gets picked up now, which is ignored or muted, and why?
- **Code quality scanning (SonarQube, …):** Is the quality gate green on the main branch? How many new blocker and critical issues? Any new security hotspot to review?
- **Security scanning (Veracode, Snyk, code scanning, Dependabot):** Any new high or critical findings? Is any finding past its fix deadline? Which gets fixed, and which gets a documented exception?
- **Monitoring and uptime:** Any alert or incident since the last run? Is anything trending the wrong way (latency, error rate, resource use)?

Keep it to about a minute when all is quiet. Dig deeper only where the owner's answers show something new.

## 4. Report and follow-up

- **The report** (local, see above) records per service: what was checked (the summary, or "no access"), the owner's answers, and the decisions.
- **Follow-up:** every "pick this up" becomes a task in the project's task list or an issue, which is committed.
- **Handing it to other checkups:** security findings that need code changes are noted for the `security` checkup; quality findings for `code-quality`.

## Opting out

The owner can stop this checkup at any time: the runner moves it from the schedule to `declined`, so it isn't suggested again, and moves it back when the owner opts in again (ADR 0037).

## Allowed production access

Read-only access to the monitoring services themselves, with credentials the owner has already configured. Never change settings, mute or resolve issues, or trigger scans without the owner's explicit instruction in this session.

## Always "Needs a human"

- Muting, resolving or ignoring issues, and accepting security findings as exceptions: the owner decides, and the report records the decision.

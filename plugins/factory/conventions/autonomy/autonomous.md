You run the work end to end, as the owner would; the owner reviews afterwards.

- **Follow the route to the end** without stopping for approval, taking your recommended option at every choice. Record each choice, the alternatives and why, in the task's document or your summary, so the owner can review it later.
- **New dependencies, tools, skills, hooks or agents:** add them when they pass the license policy and, for tools and plugins, the toolbox's security record. Report each one.
- **Decisions that need an ADR:** write it with status **Proposed**, act on it, and list it for the owner to accept or reject.
- **Pull requests:** merge your own work when the checks pass and a `review` agent found nothing of high or medium severity. Merge checkup PRs when their checks pass; their "Needs a human" items become tracked tasks.
- **Limits:** at most 10 subagents per task, and at most 3 attempts to fix the same failing check. Hitting a limit means the task is bigger or harder than it looked: stop, and report what you did and what you would try next.
- **Stop and ask** when triage would now choose a bigger or riskier route, or when no option can be recommended from the conventions, the ADRs or the owner's recorded preferences.

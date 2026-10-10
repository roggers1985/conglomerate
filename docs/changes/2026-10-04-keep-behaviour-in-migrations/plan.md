# Plan: Keep behaviour the same in migrations, and write tests apart from the code

## Approach

The change has two parts. Part 1, migrations that keep behaviour (AC-1 to AC-8), is built and fixed (tasks T-1 to T-4). Part 2 (AC-9 to AC-14) separates who writes a test from who writes the code, and makes tests prove that they can fail. Its tasks are T-5 onwards.

**Part 1: migrations that keep behaviour (built)**

The convention comes first, then the stages that enforce it, then the record.

1. **The convention.** `code-testing` gets a section on behaviour tests for migrations, and `core.md` one line that points to it.
2. **The script check.** The migration plan gets a gate, like the spike's: `migrationPlanProblems` in `stage-gates.ts` checks the five sections. The route check runs it when the migration-plan stage is done.
3. **The stages.** Each skill that a migration passes through gets its part:
   - triage adds the migration-plan stage for code migrations that keep behaviour;
   - planning gets the migration plan's template;
   - build makes the behaviour test the first task, run on the old code;
   - review checks that the test passed on the old code and stayed unchanged.

   The template test also runs the new template through its gate.
4. **The record:** an ADR and two glossary entries.

**Part 2: tests written apart from the code (AC-9 to AC-14)**

The idea: on the standard and full tracks, every task with testable behaviour is built by two agents in turn. A **test agent** writes the tests from the spec and commits them failing. A different **code agent** then makes them pass, without touching the tests. When the code agent thinks a test is wrong, an **arbiter** rules once. The review then breaks the code on purpose to see each criterion's test fail.

1. **The build (`factory-build`, AC-9 and AC-10).** Step 3 of "Each task" becomes three steps:
   - **The test agent** works in its own worktree, on the branch `change/<name>--T-<n>--tests`, created from the change's branch. It reads `spec.md`, its task and the conventions, and nothing of the implementation. The task's new `Tests` field names the interface it tests (see 3). For a migration it also gets the migration plan's Behaviour test section. It may read the signature and doc comment of an existing export it tests, never its body. It writes the tests, runs them, and commits them failing.
   - **The coordinator checks the red run** on that branch. The tests must fail because the behaviour is missing: an assertion, or an import of an export the task adds. A broken test (a syntax error, a wrong path to an existing module) is a failed attempt. A test that already passes is either vacuous, which is a failed attempt, or shows the behaviour exists, which goes back to the owner. `verification.md` records the run under Checks: the task, the commit and how many tests failed.
   - **The code agent** works in a second worktree, on `change/<name>--T-<n>`, created from the test agent's branch. It makes the tests pass and stays out of the test agent's files. Before merging, the coordinator checks that those files are identical on both branches (`git diff change/<name>--T-<n>--tests change/<name>--T-<n> -- <files>` is empty). A difference fails the attempt.
   - **When the code agent finds a test wrong,** it stops without editing it, and replies with the test, the failing output and its reason. The coordinator dispatches the **arbiter**: a fresh `factory:tasks:review` agent in its own worktree, given the spec, the test and the failing output, and nothing else. It rules one of three ways:
     - *the code is wrong:* the code agent carries on (resumed with `SendMessage`);
     - *the test is wrong:* the test agent is resumed, corrects the test and commits it on its branch, and the code agent merges that branch into its own and carries on;
     - *the spec is unclear:* the task stops and goes to the owner. An amended spec is approved through `factory-intake`, and the test agent's tests follow it.

     There is at most one arbitration per task. A second dispute goes to the owner, at every autonomy level. Each ruling goes into a new `## Rulings` section of `verification.md`.
   - **The coordinator merges** `change/<name>--T-<n>`, which holds the test commits followed by the code commits, so the history shows the tests came first. It then removes both worktrees and both task branches.
   - **The quick track** keeps one agent for both, as today. The review checks the tests (point 5) and breaks the code (the mutation check), which makes up for the missing second agent.
   - **A task with no testable behaviour** (its `Tests` field says `none: <why>`) skips the test agent. It is built by one agent, as today.
   - **A migration's first task** is a test agent's task with no code agent. The test agent writes the behaviour test and sees it *pass* on the old code: the one case where its tests aren't red. Later tasks change the code under test, and their code agents make the new code pass the test. Changing the assertions for an intended difference at the swap is a test change, so the test agent of the swap task makes it, within the limits of "What 'unchanged' means" in `code-testing`.
2. **The roles and limits.**
   - **Agent routing.** The test agent is `factory:tasks:code`, or `code-complex` when the task's code is routed there. It is never `code-small`: writing tests from a spec involves the conventions. The code agent is routed as today. The arbiter is `factory:tasks:review`. `models.json` doesn't change.
   - **`attemptsPerTask` counts per role.** The test agent has that many attempts to produce tests that fail for the right reason. The code agent has that many to make them pass. A code agent that stops to dispute a test hasn't failed an attempt.
   - **Escalation per role.** When a role's last attempt fails, that role escalates once (`code-complex`, then `model: "fable"`, ADR 0021). Then the build stops and reports.
   - **`Parallel: yes`.** Within a task the agents run one after another, so a task never has more than one agent running. `parallelTasks` keeps counting tasks, and parallel tasks each run their own sequence.
3. **Planning (`factory-planning`, AC-6 and AC-9).** The tasks section gets two rules:
   - **Each task says what its test agent tests,** in a new optional field `Tests`. It names the interface (a function, a command, an endpoint), or says `none: <why>` for a task with no testable behaviour, such as a rename or text. `none` skips the test agent. The gate ignores fields it doesn't know, so it needs no change.
   - **When the route has a migration plan,** T-1 writes the behaviour test and runs it on the old code, and every task that changes the code under test depends on T-1. This resolves finding 4 of `review.md`.

   The line "Tests are part of each task" now says that the test agent writes them and the code agent makes them pass. The tasks template shows the `Tests` field.
4. **The review (`factory-review`, AC-12).** Point 1 ("The spec, criterion by criterion") ends with the mutation check, described in a new part "The mutation check" below the list. For each criterion whose evidence is a test, the reviewer:
   - makes the smallest change in the production code that breaks what the criterion states, such as inverting a condition, removing a guard, moving a limit by one or skipping an error path;
   - runs the named test and sees it fail;
   - restores the code before the next change.

   Every error path and limit the criterion has gets its own break. A criterion whose evidence is only skill or document text is skipped, with that reason. The reviewer does this in its own worktree, which is thrown away after the review. It commits nothing and restores each change. The worktree rule "change nothing" becomes "commit nothing, and leave the worktree clean".

   The reviewer records each break in a new section of `review.md`, `## Mutation checks`: a table with Criterion, Test, What was broken and Result. The result is `failed`, `stayed green: finding <n>`, or `skipped: <why>`. A test that stays green is a finding in the findings table:
   - **high** when the break hits what the criterion states, because the criterion then has no evidence that holds;
   - **medium** when it hits an edge case or limit around the criterion, like a missing edge-case test.

   Fixing it is a test change, so the test agent strengthens the test. The proof is that the new test fails on the break the review recorded and passes on the code. A code agent follows only when the stronger test fails on the code. "Closing the findings" refers to this flow.
5. **The conventions (AC-11, AC-13).**
   - **`code-testing`** gets a section "Tests that read as a specification", right after "Which tests at which level", for tests at every level. A test's name states the behaviour in domain words, with the criterion id in front where ADR 0054 asks for it (`it("AC-1: downloads the jobs as CSV")`). One behaviour per test. Arrange, act and assert are visible. A failure says which behaviour broke, through the name and an assertion message where the value alone doesn't. In an end-to-end test, one flow is one behaviour, and its steps may alternate act and assert. The two bullets that say part of this under "Unit and integration tests" move into the new section, so it is said once.
   - **`code-readability`** gets a short section "Comments", after "Names". Names say what. A comment says why, at a place where the why isn't obvious: a constraint, an ADR, a rejected alternative. It never repeats what the code does. An avoid/prefer example shows it. Its description adds comments, so the skill loads when writing them.
   - **`code-documentation`** sharpens its bullet "Internal code only gets a comment when the why isn't obvious" with the same three kinds of why. It also says how this fits doc comments on exports (see "Conventions and decisions").
6. **The record (AC-14).**
   - ADR 0063 records AC-9 to AC-13. It amends ADR 0054 and ADR 0055, and their Status lines get "Amended by ADR-0063", as ADR 0058 did. ADR 0062 stays about migrations.
   - The glossary gets "Test agent", "Arbiter" and "Mutation check". The last is next to "Mutation testing", with the difference: manual and targeted, in the review. The entries "Build, verify and spike" and "Review and security review" mention them.
   - `docs/readiness.md`: the Review row adds the mutation check.
   - `TODO.md`: the evidence script item also covers the new records. It could check that each criterion with a test has a mutation check, and that the code agent didn't change the test agent's files.

**How this change is built.** T-7 and T-9 are the only tasks with a test, `scripts/skill-templates.test.ts`. Build them with the new split, as a first trial. A `code` test agent writes the template test and commits it red, then a `writing` agent changes the skill text without touching the test. `verification.md` records both runs. The other tasks are text with no testable behaviour (`Tests: none`), built by one `writing` agent each.

All of it lives in unit `factory`, with no new dependencies.

## Files and data

**Part 1 (built):**

| File | What changes |
|---|---|
| `plugins/factory/skills/code-testing/SKILL.md` | A section on behaviour tests for migrations. |
| `plugins/factory/conventions/core.md` | One line under Tests. |
| `plugins/factory/scripts/stage-gates.ts` and its test | `MIGRATION_PLAN_SECTIONS` and `migrationPlanProblems`. |
| `plugins/factory/scripts/changes.ts` and its test | Reads `migration-plan.md` and runs its gate when the stage is done. `dist/changes.js` is regenerated. |
| `plugins/factory/skills/factory-triage/SKILL.md` | The migration-plan deviation also covers code migrations. |
| `plugins/factory/skills/factory-planning/SKILL.md` | The migration plan's template and its gate. |
| `plugins/factory/skills/factory-build/SKILL.md` | The behaviour test as the first task, run on the old code. |
| `plugins/factory/skills/factory-review/SKILL.md` | The review's migration check. |
| `scripts/skill-templates.test.ts` | Also runs the migration plan's template through its gate. |
| `docs/decisions/0062-keep-behaviour-in-migrations.md` | New. |
| `GLOSSARY.md`, `TODO.md` | Two entries; the gate limitation for criteria with a sub-list. |

**Part 2:**

| File | What changes |
|---|---|
| `plugins/factory/skills/code-testing/SKILL.md` | New section "Tests that read as a specification"; two bullets move into it from "Unit and integration tests". |
| `plugins/factory/skills/code-readability/SKILL.md` | New section "Comments"; its description adds comments. |
| `plugins/factory/skills/code-documentation/SKILL.md` | The internal-code bullet names the three kinds of why, and how it fits doc comments on exports. |
| `plugins/factory/skills/factory-build/SKILL.md` | "Each task": test agent, red run, code agent, arbiter, merge. Attempts and escalation per role. The quick track, tasks without tests and a migration's first task. The verification template gets `## Rulings`, and its Checks example a red run. |
| `plugins/factory/skills/factory-planning/SKILL.md` | The tasks section: the `Tests` field, T-1 for a migration route and the dependencies on it, and the template's `Tests` lines. |
| `plugins/factory/skills/factory-review/SKILL.md` | Point 1 ends with the mutation check, a new part "The mutation check", the worktree rule, the review template's `## Mutation checks`, and "Closing the findings". |
| `scripts/skill-templates.test.ts` | Two tests: the verification template records rulings, and the review template records mutation checks. |
| `docs/decisions/0063-tests-written-apart-from-the-code.md` | New. |
| `docs/decisions/0054-build-verify-and-spike.md`, `docs/decisions/0055-review-and-security-review.md` | One Status line each: "Amended by ADR-0063". |
| `GLOSSARY.md` | Three new entries, two updated. |
| `docs/readiness.md` | The Review row. |
| `TODO.md` | The evidence script item. |
| `plugins/factory/CATALOG.md` | Regenerated by the coordinator after the merge (`bun run generate`), because a description changes. |

No data, schema or configuration changes. `verification.md` and `review.md` each get one section that no script reads: the gates check only their required sections, and the pull request description reads only Evidence and the findings table. No script changes, because the spec asks for none.

## Trade-offs

Part 1:

**Where the gate lives: in `stage-gates.ts`, or in a module of its own?** In `stage-gates.ts`, next to the spike's gate, which it copies. A module of its own would hold three lines. This is also the simplest option.

**The section names.** The current bullet list becomes five headings: Steps, Old and new, Behaviour test, Verification and Rollback. Headings are what the other gates check, so the gate stays one call to `sectionProblems`.

**Checking that the behaviour test stayed unchanged: a script or the review?** The review, as the spec decided. A script would have to know which test is the behaviour test and which commit is the swap. The review reads both from the migration plan and the diff.

Part 2:

**Where the test agent fits: inside a task, or as tasks of its own?** Inside a task, in the build. The simplest option is today's flow, one agent told to write and commit the tests first. The spec rules it out: the same context would repeat its own reading of the spec. Splitting every task into a test task and a code task was also rejected. It doubles the task list, the planner would have to pair them by hand, and the gate can't see the pairing. A skill of its own for test authorship would add a skill, which needs the owner, and the flow belongs to the build.

**The test agent's branch: its own, or shared with the code agent?** Its own, `change/<name>--T-<n>--tests`, with the code agent's branch created from it. A shared branch is simpler, but two worktrees can't hold one branch. After a ruling that a test is wrong, the test agent would have to wait for the code agent to give the branch up. Two branches also give the check that the code agent left the tests alone: one `git diff` between them.

**The test agent's input: the task, or the plan?** The task, as the spec says ("`spec.md`, the task and the conventions only"). The task then has to name the interface, hence the `Tests` field. The other option, the plan's "Files and data", would also show the design of the code, which is more than the spec allows.

**The arbiter: what it sees.** The spec, the test and the failing output, and the code agent's reason. Not the code: a judge who reads the code tends to accept its reading of the spec. A `review` agent, because judging a test against a spec is review work, and the spec forbids new agent types.

**Where rulings are recorded: `verification.md` or the task list?** `verification.md`, in `## Rulings`, with "None." when there were none. The task list is the plan, and a ruling is a record of the build, like the red runs under Checks. A field in the task list would also go unchecked, because the gate ignores fields it doesn't know.

**Recording the mutation check: a column or a section?** A section, `## Mutation checks`. The review gate and the pull request description read the findings table as exactly five columns, so a sixth column would break both. A green test still becomes a row in the findings table, so the gate keeps it from being left open.

**A gate for the new records?** No. The spec asks for none, and the review checks them. The `TODO.md` item on an evidence script can take them on later.

**Where the comment rule lives.** In `code-documentation`, which owns comments (ADR 0016), and in `code-readability` as a short section with an example, because the spec names both. `core.md` already says the gist ("Internal code only gets a comment when the *why* isn't obvious"), so it doesn't change.

## Costs

Part 1: negligible. One more document of at most 1 MiB is read, only for a change whose route has a migration plan.

Part 2:

- **Tokens in the build.** A task with testable behaviour now runs two agents instead of one. A task agent run takes roughly 50,000 to 150,000 tokens. The test agent's is smaller, roughly 30,000 to 80,000, since it writes no code. So such a task costs about 40 to 60% more. Text-only tasks cost the same, because they skip the test agent.
- **The arbiter** runs only on a dispute, at most once per task: one Opus run on a small input (the spec, one test, its output), roughly 20,000 to 40,000 tokens.
- **The mutation check.** Each break is an edit, one test file run and a restore: about 4,000 tokens on Opus. A change with 10 criteria and two breaks each adds about 80,000 tokens to the review. The test runs take seconds, since one test file runs in under a second here.
- **Disk.** The test agent's worktree stays until the task is merged, so a task has two worktrees at once. Here a worktree holds about 100 MB of installed dependencies. With 3 parallel tasks, that is up to 6 worktrees, about 600 MB, freed after each merge.
- **Subagents.** A task with tests uses two or three subagents instead of one. At `autonomous`, a change reaches `subagentsPerChange` (10 by default, ADR 0058) after about four such tasks. See "Conventions and decisions".

## Conventions and decisions

Follows the conventions and ADRs, with the points below. The ones that matter most here:

- **The stage gates** (ADR 0052 to 0055): the migration plan gets one like the others, and the template test covers its template. The new sections of `verification.md` and `review.md` stay outside the gates; the template test checks that the templates have them.
- **Reading files a branch controls** (ADR 0060): `migration-plan.md` goes through the existing change-document reader.
- **Lead by logic, not by numbers** (ADR 0038): the convention says when and how to write the test, not how many.
- **Writing for people** (ADR 0061): the ADRs, the glossary and the templates follow the writing convention.
- **Task agents and model routing** (ADR 0014, 0015, 0021): the test agent and the arbiter are roles in the prompt of existing task agents, and `models.json` doesn't change.
- **Worktrees and branches** (ADR 0042, 0054): each agent of a task gets its own worktree, and the task's branches are created from the change's branch.
- **Limits** (ADR 0032, 0058): one arbitration per task; `attemptsPerTask` per role; `parallelTasks` unchanged.

New decisions:

- **ADR 0062:** a migration meant to keep behaviour first gets a behaviour test that passes on the old code and then on the new code unchanged, enforced by the stages.
- **ADR 0063** records four rules:
  - a test agent writes the tests apart from the code agent, with one arbitration per task;
  - tests read as a specification;
  - the review breaks the code to see each criterion's test fail;
  - comments say why.

  It amends ADR 0054 (the build's task flow) and ADR 0055 (what the review checks). It also extends ADR 0053's task format with the optional `Tests` field.

**Checked against existing rules (AC-11, AC-13).**

- **AC-11 conflicts with no rule.** `code-testing` already asks for one behaviour per test, named after it, with arrange, act and assert. AC-11 widens this to every level and adds domain words and readable failures. ADR 0054's `AC-<n>:` prefix stays in front of the domain words. End-to-end tests are the one place where "arrange, act, assert" needs a gloss: one flow is one behaviour.
- **AC-13 conflicts with the summary of a doc comment, read literally.** "Comments in production code … never repeat what the code does" would forbid the TSDoc summary, "what it does, in one sentence" (`code-documentation`, ADR 0016). The narrowest wording that keeps both: the rule applies to comments in a function's body and on internal code. A doc comment on an export describes the contract for a caller who doesn't read the body (what it does, its parameters, what it throws), which isn't repeating the code. Its why goes in `@remarks`. ADR 0016 doesn't change, and ADR 0063 says so. `core.md` and `code-readability`'s naming rules don't conflict.

**Open for the owner:**

- [NEEDS CLARIFICATION: The `Tests` field extends the task format of ADR 0053, which the spec doesn't name. It lets the test agent work from the task alone, and says when the test agent step is skipped. Recommendation: add it, as an optional field the gate ignores, and record it in ADR 0063. The other option is a sentence in each task's title or Verify line, which the build would have to find by reading.]
- [NEEDS CLARIFICATION: At `autonomous`, the split makes a change hit `subagentsPerChange` (10 by default) after about four tasks with tests. Recommendation: leave the default and the rule unchanged in this change, which the spec keeps to ADR 0058's limits. Note the effect in ADR 0063's consequences, and add a `TODO.md` item to revisit the default after the first change built at `autonomous`. The other option is to count a task's agents as one subagent, which changes `autonomous.md`.]

**Deviations:**

- T-1 and T-3 are writing tasks and go to the `writing` task agent. T-2 is code and goes to the `code` agent.
- T-5, T-6, T-8 and T-10 go to the `writing` agent. In T-7 and T-9, a `code` test agent writes the template test, and the `writing` agent changes the skill text (see "How this change is built").
- This route is on the full track, which keeps tasks in `tasks.md`. Part 1 was planned on the standard track, so its tasks are in this plan, and Part 2's tasks follow them here. At the tasks stage, the whole list (T-1 to T-4 done, T-5 onwards pending) moves to `tasks.md`, because the route check reads the task list from there on the full track, and it must cover AC-1 to AC-14.

## Tasks

### T-1: Write the convention in code-testing and core.md

- Files: `plugins/factory/skills/code-testing/SKILL.md`, `plugins/factory/conventions/core.md`
- Covers: AC-1, AC-2
- Verify: `bun run check`
- Depends on: none
- Parallel: yes
- Status: done

### T-2: Add the migration plan's gate to the route check

- Files: `plugins/factory/scripts/stage-gates.ts`, `plugins/factory/scripts/stage-gates.test.ts`, `plugins/factory/scripts/changes.ts`, `plugins/factory/scripts/changes.test.ts`
- Covers: AC-5
- Verify: `bun test plugins/factory/scripts/stage-gates.test.ts plugins/factory/scripts/changes.test.ts`, `bun run doctest` and `bun run check`
- Depends on: none
- Parallel: yes
- Status: done

### T-3: Teach triage, planning, build and review about migrations

- Files: `plugins/factory/skills/factory-triage/SKILL.md`, `plugins/factory/skills/factory-planning/SKILL.md`, `plugins/factory/skills/factory-build/SKILL.md`, `plugins/factory/skills/factory-review/SKILL.md`, `scripts/skill-templates.test.ts`
- Covers: AC-3, AC-4, AC-6, AC-7
- Verify: `bun test scripts/skill-templates.test.ts` and `bun run check`
- Depends on: T-2
- Parallel: no
- Status: done

### T-4: Record the decision

- Files: `docs/decisions/0062-keep-behaviour-in-migrations.md`, `GLOSSARY.md`, `TODO.md`
- Covers: AC-8
- Verify: `bun run check`
- Depends on: T-1, T-3
- Parallel: no
- Status: done

### T-5: Make tests read as a specification in code-testing

- Files: `plugins/factory/skills/code-testing/SKILL.md`
- Covers: AC-11
- Tests: none: skill text only
- Verify: `grep -n "^## Tests that read as a specification" plugins/factory/skills/code-testing/SKILL.md` finds the section, the two moved bullets are no longer under "Unit and integration tests", and `bun run check` passes
- Depends on: none
- Parallel: yes
- Status: pending

### T-6: Make comments say why in code-readability and code-documentation

- Files: `plugins/factory/skills/code-readability/SKILL.md`, `plugins/factory/skills/code-documentation/SKILL.md`
- Covers: AC-13
- Tests: none: skill text only
- Verify: `grep -n "^## Comments" plugins/factory/skills/code-readability/SKILL.md` finds the section, `code-documentation` names the three kinds of why and how they fit an export's doc comment, and `bun run check` passes on the change's branch after the merge and `bun run generate` (the description changes the catalog)
- Depends on: none
- Parallel: yes
- Status: pending

### T-7: Build each task with a test agent, a code agent and an arbiter

- Files: `plugins/factory/skills/factory-build/SKILL.md`, `scripts/skill-templates.test.ts`
- Covers: AC-9, AC-10
- Tests: the build skill's verification template, through `scripts/skill-templates.test.ts` › "AC-10: the verification template records the arbiter's rulings"
- Verify: the test agent's run of `bun test scripts/skill-templates.test.ts` fails on the new test only; after the skill text, it passes with the test file unchanged; `bun run check` passes
- Depends on: none
- Parallel: yes
- Status: pending

### T-8: Plan a test agent's input, and the behaviour test first

- Files: `plugins/factory/skills/factory-planning/SKILL.md`
- Covers: AC-6, AC-9
- Tests: none: skill text only; the existing template test keeps the tasks template passing its gate
- Verify: `bun test scripts/skill-templates.test.ts` passes, the tasks template shows a `Tests` line in each task, the tasks section has the migration rule, and `bun run check` passes
- Depends on: none
- Parallel: yes
- Status: pending

### T-9: Break the code in the review to see each criterion's test fail

- Files: `plugins/factory/skills/factory-review/SKILL.md`, `scripts/skill-templates.test.ts`
- Covers: AC-9, AC-12
- Tests: the review skill's review template, through `scripts/skill-templates.test.ts` › "AC-12: the review template records the mutation checks"
- Verify: the test agent's run of `bun test scripts/skill-templates.test.ts` fails on the new test only; after the skill text, it passes with the test file unchanged; `bun run check` passes
- Depends on: T-7
- Parallel: no
- Status: pending

### T-10: Record the decision for tests written apart from the code

- Files: `docs/decisions/0063-tests-written-apart-from-the-code.md`, `docs/decisions/0054-build-verify-and-spike.md`, `docs/decisions/0055-review-and-security-review.md`, `GLOSSARY.md`, `docs/readiness.md`, `TODO.md`
- Covers: AC-14
- Tests: none: documentation only
- Verify: ADR 0063 exists and names ADR 0054 and 0055 as amended, both have the Status line, `grep -n "^\*\*Test agent\|^\*\*Arbiter\|^\*\*Mutation check" GLOSSARY.md` finds three entries, and `bun run check` passes
- Depends on: T-5, T-6, T-7, T-8, T-9
- Parallel: no
- Status: pending

---
name: tdd-slice
description: Build one slice of docs/06-build-plan.md test-first (red, green, refactor, a commit at each step), run the spec-reviewer, and save AI notes. Invoke as /tdd-slice S<n> [notes].
disable-model-invocation: true
argument-hint: "S<n> [notes for this slice]"
---

# Build slice $0 test-first

You are building slice **$0** from `docs/06-build-plan.md`. The reviewers grade the git history: every behaviour must arrive as a failing-test commit followed by a passing-code commit, with the test output shown in this session as evidence. A plausible slice built in the wrong order fails the assessment, so process matters as much as the code.

My notes for this slice (may be empty): $ARGUMENTS

## Rules for the whole session (they still apply after compaction)
1. No production code without a failing test that needs it.
2. Never edit, skip, weaken or delete a test to make it pass. If a test looks wrong, stop and ask.
3. A gap or contradiction in the docs: stop. Start your reply with `BLOCKED:`, quote the doc and section, list the options, and wait. Don't pick one yourself.
4. Show evidence, don't assert it: after every test run, paste the command and its summary lines.
5. When I correct, override or reject something you did, append it to `.ai-notes/$0/overrides.md` straight away: what you did, what I said, what changed, the commit it affects.
6. Stage explicit paths. Nothing in `.ai-notes/` is ever staged.
## 0. Set up
1. Save my invocation verbatim (`/tdd-slice` line and notes) to `.ai-notes/$0/prompt.md`. Do this before anything else.
2. Check the branch with `git status`. The tree must be clean. If you're on `main`, create the slice branch: `s<n>-<slice name in kebab case>`, for example `s3-employee-list`. If you're on another slice's branch, stop with `BLOCKED:`.
3. Read the `### $0` section of `docs/06-build-plan.md`, every `docs/05-test-strategy.md` row it points at, and the sections its **Docs** line lists. Read nothing else up front.
## 1. Test list and plan, then wait
1. Write `.ai-notes/$0/test-list.md`: one line per test with a `[ ]` box, its level (U, I, C or E), the name as the `it(...)` will read, and its source (`05 §5.3 I row 1`).
2. Group the tests into cycles of 1 to 4 related tests, in build order. For each cycle give the files you'll touch and the red and green commit subjects. Steps with no behaviour (config, wiring) get one `chore`, `build` or `ci` commit each and no cycle.
3. List each acceptance criterion of the slice and the test or check that proves it. Name any criterion nothing proves yet.
4. Present the test list and plan, then stop and wait for my approval. In plan mode, present them in the plan you submit for approval.
## 2. Cycles
For each cycle, in order:

**Red**
1. Write the tests. For each new export, add a stub with the final signature whose body is `throw new Error('not implemented')`, so imports and types resolve.
2. Run only the new tests and show the result. A valid red fails on an assertion or on `not implemented`. An import, syntax, type or setup error is not a valid red: fix the test setup and run again.
3. `npm run typecheck`, then commit `test(scope): <behaviour>` with the tests and stubs only.
A new test that passes on its first run means the behaviour already exists. Write no production code. Prove the test can fail: break the line it guards, show the failure, restore the line, show it passing. Commit it as `test(scope): <behaviour>` with the body `Already satisfied by <short hash>.`

**Green**
1. Write the least production code that passes the cycle. Touch no test files.
2. Run `npm test` and `npm run typecheck`, and show the summary.
3. Commit `feat(scope): <capability>` (or `fix(scope)`). Tick the cycle's rows in `test-list.md`.
**Refactor** (roughly one cycle in three, only when something is worth improving)
1. Change structure, not behaviour. No test file edits.
2. Run `npm test`, show the summary, commit `refactor(scope): <what changed>`.
If a commit hook rejects a commit, read its message, fix the cause and commit again.

This is what one cycle's evidence and commits look like:

```
$ npm test -- --project api apps/api/src/domain/salary-rules.test.ts
 FAIL  salary-rules > rejects a merit raise that changes the level
   Error: not implemented
 Tests  1 failed (1)
[s6-salary-change 3f2a1c9] test(salary): reject a merit raise that changes the level

$ npm test
 Test Files  41 passed (41)
      Tests  212 passed (212)
[s6-salary-change 8b7d004] feat(salary): enforce same position for merit and market adjustments
```

## 3. Finish
1. Run `npm run lint`, `npm run typecheck` and `npm run test:coverage`. Show the summaries. Fix any failure test-first.
2. Check what you can of the definition of done in `docs/06-build-plan.md` §3.5: every row ticked, no `.only` or `.skip`, every new route in the access matrix's expected table.
3. Write the review inputs: `git diff main...HEAD > .ai-notes/$0/diff.patch` and `git log --reverse --format='%h %s' main..HEAD > .ai-notes/$0/commits.txt`.
4. Use the `spec-reviewer` subagent with this task: `Review slice $0. Diff: .ai-notes/$0/diff.patch. Commits: .ai-notes/$0/commits.txt.` If it runs in the background, end your turn with `Waiting for spec-reviewer.` and carry on when its report arrives. Save the report verbatim to `.ai-notes/$0/review.md`.
5. Under the report in `review.md`, give each finding your proposed action: fix with a new red and green cycle, or disagree and why. Show me the list and wait. Fix only the findings I approve, test-first.
6. Make sure `.ai-notes/$0/overrides.md` exists; write `None.` if I never corrected you. Append to `.ai-notes/log.md`: slice, date, commit range, cycles, overrides count, reviewer findings and their outcome.
7. Finish with `git log --oneline main..HEAD`, the test count, the coverage summary and anything left open. Don't push or open the pull request; I do that.

---
name: tdd-build
description: Run one group of TDD cycles for a planned slice. Read the brief and test list from .ai-notes, work through the listed cycles test-first, and write a handoff note. Invoke as /tdd-build S<n> <cycles> (e.g. /tdd-build S3 A-C). Use Sonnet at effort medium for this session; never switch model mid-session.
disable-model-invocation: true
argument-hint: "S<n> <cycles> (e.g. S3 A-C)"
---

# Build slice $0 cycles $ARGUMENTS

You are building specific cycles of slice **$0**. The plan and spec are already written. Read the files below — do not open `docs/04` or `docs/05` directly. If `brief.md` is silent on something, stop with `BLOCKED:`, quoting the relevant section name and the options.

## 0. Orient
1. Read `.ai-notes/$0/brief.md` and `.ai-notes/$0/test-list.md` in full.
2. Read `.ai-notes/$0/plan.md` to find the cycles assigned to this session.
3. `git log --oneline main..HEAD` to see what is already done.
4. Run `npm test 2>&1 | tail -5` to confirm the tree is green.

## Rules (apply for every turn in this session)
1. No production code without a failing test that needs it.
2. Never edit, skip, weaken or delete a test to make it pass. If a test looks wrong, stop and ask.
3. If `brief.md` is silent or contradicts something, stop with `BLOCKED:`, quote the field and options, wait.
4. Evidence is the test run's tool output in this session. Don't repeat or paste it in your reply; state red or green in one line.
5. When I correct something, append it to `.ai-notes/$0/overrides.md` immediately.
6. Stage explicit paths. Nothing in `.ai-notes/` is ever staged.

## 1. Cycles
Work through only the cycles assigned to this session, in order.

**Red — for each cycle**
1. Write the tests. For each new export add a stub whose body is `throw new Error('not implemented')`.
2. Run only the new tests and show the result. A valid red fails on an assertion or `not implemented`. An import, syntax, type or setup failure is not valid — fix it and rerun.
3. Chain: `npm test -- <file> 2>&1 | tail -12 && npm run typecheck && git add <explicit paths> && git commit -m "test(scope): <behaviour>"`

If a new test passes on its first run, prove the test can fail by breaking the line it guards, show the failure, restore it, show it passing, and commit with body `Already satisfied by <hash>.`

**Green — for each cycle**
1. Write the least production code that passes the cycle. Touch no test files.
2. Chain: `npm test 2>&1 | tail -8 && npm run typecheck && git add <explicit paths> && git commit -m "feat(scope): <capability>"`
3. Tick the cycle's rows in `test-list.md` (edit the file directly, no git stage).

**Refactor** (roughly one cycle in three, only when something is genuinely worth improving)
1. Change structure, not behaviour. No test file edits.
2. `npm test 2>&1 | tail -8`, commit `refactor(scope): <what changed>`.

If a commit hook rejects a commit, read its message, fix the cause, and commit again. Never `--no-verify`.

## 2. Wrap up this session
When all assigned cycles are done:
1. Append to `.ai-notes/$0/handoff.md`:
   ```
   ## Session <label> done (cycles $ARGUMENTS)
   Last commit: <hash> <subject>
   Open rows: <list any test-list rows still unchecked, or "none">
   Notes: <anything the next session should know>
   ```
2. End the session. The next build session runs `/tdd-build $0 <next cycles>`, or the finish session runs `/tdd-finish $0`.

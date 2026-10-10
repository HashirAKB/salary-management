---
name: tdd-finish
description: Finish a slice — lint, coverage, spec review, overrides log. Run after all /tdd-build sessions for the slice are done. Invoke as /tdd-finish S<n>.
disable-model-invocation: true
argument-hint: "S<n>"
---

# Finish slice $0

Run this in a fresh Sonnet session after all build sessions for slice **$0** are complete.

## 0. Orient
1. Read `.ai-notes/$0/test-list.md` — every row must be ticked. If any is open, stop with `BLOCKED:`.
2. `git log --oneline main..HEAD` to confirm the commit trail.

## 1. Quality checks
Run these in sequence and show the output:
```
npm run lint 2>&1 | tail -5
npm run typecheck 2>&1 | tail -5
npm run test:coverage 2>&1 | tail -12
```
If any fails, fix it test-first: write the failing test (red commit), then the fix (green commit), same rules as `/tdd-build`.

Check the definition of done in `docs/06-build-plan.md` §3.5: every row ticked, no `.only` or `.skip`, every new route in the access matrix expected table.

## 2. Review inputs
```
git diff -U2 main...HEAD -- . ':!package-lock.json' > .ai-notes/$0/diff.patch
git log --reverse --format='%h %s' main..HEAD > .ai-notes/$0/commits.txt
```

## 3. Spec review
Use the `spec-reviewer` subagent with this task:
```
Review slice $0.
Brief: .ai-notes/$0/brief.md
Test list: .ai-notes/$0/test-list.md
Diff: .ai-notes/$0/diff.patch
Commits: .ai-notes/$0/commits.txt
```
If it runs in the background, end your turn with `Waiting for spec-reviewer.` and carry on when it arrives. Save the report verbatim to `.ai-notes/$0/review.md`.

## 4. Act on findings
Under the report in `review.md`, give each finding your proposed action: fix test-first, or disagree and why. Present the list and wait. Fix only findings I approve, test-first.

## 5. Wrap up
1. Ensure `.ai-notes/$0/overrides.md` exists; write `None.` if I never corrected you.
2. Append to `.ai-notes/log.md`:
   ```
   ## $0 <slice name> (<date>)
   Branch: <branch>. Commits: <first>..<last> (<count> commits).
   Sessions: P + B1 [+ B2 …] + R.
   Cycles: <list>. Overrides: <count>. Reviewer: <PASS/GAPS FOUND, findings and outcome>.
   Tests: <count> passing. Coverage: green/floor.
   Open: <anything left for you to do, or "none">.
   ```
3. End with `git log --oneline main..HEAD`, the test count, the coverage floor line and any open items. Don't push or open the PR — you do that.

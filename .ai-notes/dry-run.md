# Dry run: prove the kit on a throwaway slice

Lives in the repo at `.ai-notes/dry-run.md`. Run it once, before S0, in a scratch folder that is not the real repo. Target: 15 minutes (3 setup, 10 session, 2 checks). If a check fails, fix the kit in your kit folder, note the fix in the results table, and re-run only that check.

## 1. Setup (3 min)

Copy the kit into a scratch folder, add a minimal TypeScript project and a fake slice S99. Run from the folder that holds the kit files (`CLAUDE.md`, `.claude/`, `scripts/`):

```bash
KIT="$PWD"
DRY="$HOME/kit-dry-run"; rm -rf "$DRY"; mkdir -p "$DRY" && cd "$DRY"
git init -q -b main
cp -R "$KIT/CLAUDE.md" "$KIT/.claude" "$KIT/scripts" .
printf 'node_modules/\n.ai-notes/\n.env\n' > .gitignore
cat > package.json <<'EOF'
{ "name": "kit-dry-run", "private": true, "type": "module",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit", "lint": "node -e 0", "test:coverage": "vitest run" } }
EOF
cat > tsconfig.json <<'EOF'
{ "compilerOptions": { "strict": true, "module": "ESNext", "moduleResolution": "Bundler", "target": "ES2022", "noEmit": true, "types": [] },
  "include": ["apps"] }
EOF
mkdir -p apps/web/src docs
cat > apps/web/src/format.ts <<'EOF'
export function formatDate(iso: string): string {
  return iso;
}
EOF
cat > apps/web/src/format.test.ts <<'EOF'
import { describe, it, expect } from 'vitest';
import { formatDate } from './format';
describe('formatDate', () => {
  it('returns the iso date unchanged for now', () => {
    expect(formatDate('2026-10-09')).toBe('2026-10-09');
  });
});
EOF
cat > docs/06-build-plan.md <<'EOF'
# 06 Build plan (dry run)

### S99 Change percentage formatter (15 min)

**Goal.** `formatChangePct(pct: number | null): string` in `apps/web/src/format.ts` for the salary history Change column.

**Test list.**
- 05 section 5.99: all rows.

**Acceptance.**
- `formatChangePct(4.25)` is `+4.3%`, `formatChangePct(-2)` is `-2.0%`, `formatChangePct(null)` is `n/a`.
- `formatChangePct(0)` is `0.0%`, with no sign.

**Expected commits.**
test(web): format change percentages with a sign and one decimal
feat(web): add change percentage formatter

**Docs.** 04 section 8.6
EOF
cat > docs/05-test-strategy.md <<'EOF'
# 05 Test strategy (dry run)

### 5.99 Change percentage

| Level | Test |
| --- | --- |
| U | a positive change shows a plus sign and one decimal |
| U | a negative change keeps its minus sign and one decimal |
| U | a missing change (null) shows n/a |
EOF
cat > docs/04-api-and-ui.md <<'EOF'
# 04 API and UI (dry run)

### 8.6 Change column
Change % shows its sign and one decimal place, rounding half away from zero. Zero shows `0.0%` with no sign. A row with no previous salary shows `n/a`.
EOF
npm install --save-dev --silent vitest typescript
cat > .git/hooks/commit-msg <<'EOF'
#!/bin/sh
node scripts/check-commit-shape.mjs "$1"
EOF
chmod +x .git/hooks/commit-msg
git add -A && git commit -qm "chore: dry run baseline" && git log --oneline
```

The S99 docs deliberately leave the zero case out of the 05 test rows while keeping it in the acceptance criteria. That is the gap the skill and the reviewer should notice.

## 2. Session (10 min)

Run each step in order. "Look for" is the pass condition.

| # | Do | Look for |
| --- | --- | --- |
| 1 | `cd ~/kit-dry-run && claude --permission-mode plan`. Run `/context`, then `/hooks`. Type `@` and look for the agent. | `CLAUDE.md` under Memory files. `/hooks` lists a PreToolUse hook on `Bash` and a Stop hook, both from project settings. `spec-reviewer (agent)` in the `@` typeahead. Accept the workspace trust prompt if it appears. |
| 2 | Type `/` and find the skill. Then send, in plain words: `build slice S99 test-first`. | `/tdd-slice` is listed with the hint `S<n> [notes for this slice]`. The plain request does **not** run the skill: Claude either does nothing skill-shaped or tells you to run `/tdd-slice` (disable-model-invocation). If it starts the TDD loop on its own, the frontmatter is wrong. Press Esc and `/clear` before step 3. |
| 3 | Send `/tdd-slice S99 Dry run of the kit.` | First tool call writes `.ai-notes/S99/prompt.md`. It creates or asks for a branch like `s99-change-percentage-formatter`. `.ai-notes/S99/test-list.md` has the three 05 rows. The plan lists the zero-case acceptance criterion as not covered by a 05 row and proposes a test for it. The plan is presented for approval, not acted on. |
| 4 | Approve with **Yes, manually approve edits**. Watch the red step. | A stub `export function formatChangePct(...) { throw new Error('not implemented'); }`. The red run fails on `not implemented` or an assertion, never on `Failed to resolve import` or a type error. Typecheck runs before the commit. Commit `test(web): ...` contains the test file and the stub only. |
| 5 | Right after the red commit, press Esc, then send: `Stop here and give me a summary. Don't implement yet.` | Claude tries to end the turn on a red tree and the Stop gate sends it back (open the transcript with Ctrl+O: a block reason starting `Stop gate: \`npm test\` failed`). Claude then either goes green or replies starting with `BLOCKED:`. A plain summary that ends the turn while red is a fail. |
| 6 | Let the cycle finish. Then send these one at a time, saying `Run exactly this command:` before each: `git commit --allow-empty --no-verify -m "chore: probe"`, then `HUSKY=0 git commit --allow-empty -m "chore: probe"`, then `git add -f .ai-notes/S99/test-list.md`, then `git commit --amend --no-edit`. | Each is denied before it runs, with a reason citing D-059, D-007 or D-008. `git log` shows no `chore: probe` commit and nothing amended. |
| 7 | Watch the permission prompts during the cycle. | In Manual mode, `npm test`, `npm run typecheck`, `git add <paths>` and `git commit` ran without a prompt. File edits and `git switch -c` did prompt. |
| 8 | Let the skill reach its finish step. | `diff.patch` and `commits.txt` written to `.ai-notes/S99/`. The `spec-reviewer` subagent runs (transcript row `spec-reviewer(...)`); its tool calls are only Read, Grep and Glob. Its report starts `### Spec review: S99`, has a verdict line, and is saved to `.ai-notes/S99/review.md` with Claude's proposed actions. Claude waits for you before fixing anything. |
| 9 | Plant a gap. In your own terminal: append `export function formatChangeAmount(minor: number): string { return String(minor / 100); }` to `apps/web/src/format.ts`, commit it as `feat(web): add change amount formatter`, then regenerate both review files with the two commands from the skill's finish step 3 (`S99`). In Claude: `Use the spec-reviewer subagent with this task: Review slice S99. Diff: .ai-notes/S99/diff.patch. Commits: .ai-notes/S99/commits.txt.` | Verdict `GAPS FOUND`, with a Test-first evidence finding (behaviour with no earlier `test(...)` commit) citing the file and line. Bonus: a Correctness finding for dividing money as a float (02 section 4). No style comments. |
| 10 | In your own terminal, try a bad commit shape: `git add apps/web/src/format.test.ts && git commit -m "feat(web): sneak a test into a green commit"` after touching the test file. | The commit-msg hook rejects it with `commit shape (D-059): A feat(...) commit is the green step and must not change tests`. Undo with `git restore --staged . && git checkout -- .`. |

## 3. Checks (2 min)

```bash
git status --short --ignored | grep ai-notes      # shows "!! .ai-notes/" (ignored)
git ls-files .ai-notes                            # prints nothing
git log --all --stat | grep -c ai-notes           # prints 0
ls .ai-notes/S99/                                 # prompt.md test-list.md diff.patch commits.txt review.md overrides.md
tail -n 8 .ai-notes/log.md                        # one entry for S99
git log --oneline main..HEAD                      # test(...) before feat(...), plus your planted commit
```

## 4. Results

## Dry run results (Sat 10 Oct 2026)

| # | Check | Pass or fail | Fix made |
| --- | --- | --- | --- |
| 1 | Kit loaded (CLAUDE.md, hooks, agent) | Pass | |
| 2 | Skill is user-only and listed | Pass | |
| 3 | Prompt saved first, test list, plan waits, zero case noticed | Pass | Also flagged an unspecified case: values that round to zero |
| 4 | Red fails for the right reason, red commit shape | Pass | |
| 5 | Stop gate blocks a red stop | Pass (retest) | First attempt sent the stop after green, so the gate had nothing to block. Retested with a red 0.04 test: blocked, Claude replied BLOCKED: |
| 6 | Guard denies no-verify, HUSKY=0, forced add, amend | Pass | |
| 7 | Allowlist removes prompts for tests, typecheck, add, commit | Pass | |
| 8 | Reviewer runs read-only, report format, waits before fixes | Pass | |
| 9 | Reviewer catches the planted gap, no style noise | Pass | GAPS FOUND on the untested feat commit; float money division also flagged |
| 10 | commit-msg rejects a test file in a feat commit | Fail, then Pass | Hook file was 0 bytes: `cat` is aliased to batcat (not installed), so the heredoc wrote nothing. Rewrote the hook with printf; rejected correctly on retest |
| 11 | `.ai-notes/` never tracked, all notes files present | Pass | |

Carry into the real build:
- S0 installs the commit-msg hook from a versioned file (.githooks/ + core.hooksPath via a prepare script), never by pasting.
- Run `unalias cat` (or use `command cat`) before running any setup script that uses heredocs.
- Check 04-api-and-ui.md for how near-zero change percentages display.

The kit is ready when rows 1 to 8, 10 and 11 pass. Row 9 failing means the reviewer prompt needs work, but it doesn't block S0: note it and run S0. Delete `~/kit-dry-run` afterwards; copy the filled table into `.ai-notes/log.md` of the real repo as the first entry.

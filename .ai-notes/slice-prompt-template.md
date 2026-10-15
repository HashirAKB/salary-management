# Slice prompt template

Lives in the repo at `.ai-notes/slice-prompt-template.md` (git-ignored; committed once at the end with the rest of `.ai-notes/`, D-007).

The `/tdd-slice` skill carries the process, so a slice prompt only carries what the docs don't: the time box, cuts in force, and what earlier slices changed. Anything that belongs in every slice goes in the skill or CLAUDE.md, not here.

## Per-slice prompt (S1 to S10)

Start each slice in a fresh session, in plan mode, from `main` with a clean tree:

```
git switch main && git pull && git status
claude --permission-mode plan
```

Then send this as the first message, with the brackets filled in or the line deleted:

```
/tdd-slice S<n>
Time box: <box from 06 §4>, ending <HH:MM IST>. If you expect to overrun, say so at the plan stage, not at the end.
Cuts in force: <none | cut N (A-0xx): leave out <what>, skip its test rows>
Carried over: <facts from earlier slices the docs don't hold yet, e.g. "S0 fell back to Vitest 4.1.x (A-0xx)", "testApp() lives in apps/api/test/helpers.ts">
Watch for: <one risk I want checked in this slice, or delete>
```

When the plan arrives, check three things before approving: every test row from 06 is in the list, the cycles are small (1 to 4 tests), and no file outside the slice's scope is touched. Approve with **Yes, manually approve edits** for S0 and S1. Switch to auto mode for later slices only if the dry run and S0 showed the hooks doing their job.

### Filled example (S3)

```
/tdd-slice S3
Time box: 1.5 h, ending 17:30 IST. If you expect to overrun, say so at the plan stage, not at the end.
Cuts in force: none
Carried over: S2 added loggedInAs(app, role) in apps/api/test/builders/users.ts; use it for every route test.
Watch for: the USD column must use the same half-up conversion as packages/shared/src/money.ts, not a second implementation.
```

## Bootstrap prompt (S0)

S0 starts from a repo with docs and the kit but no code. Before the session, by hand:

1. Create the repo, add `docs/` (00 only sections 1 and 2, D-020), commit with `docs:` commits.
2. Add `.gitignore` (`node_modules/`, `dist/`, `.ai-notes/`, `.env`, `*.db`, `e2e/.data/`, `.vitest/`), `CLAUDE.md`, `.claude/` and `scripts/check-commit-shape.mjs`. Commit as `chore: add claude code kit and gitignore`. The ignore file comes before any `.ai-notes/` file exists, so nothing there can be staged by accident.
3. Create `.ai-notes/` and copy this template and `dry-run.md` into it.
4. Create the empty GitHub repo, push `main`. Have the Turso and Render accounts open: S0 asks you to create the database and service.
Then `git switch -c s0-walking-skeleton`, `claude --permission-mode plan`, and send:

```
/tdd-slice S0
Time box: 1.5 h, ending <HH:MM IST>.
This is the bootstrap slice. The repo has docs/, CLAUDE.md, .claude/, scripts/check-commit-shape.mjs and .gitignore, and no package.json.
- .gitignore is already committed, so drop 06's "chore: ignore .ai-notes..." commit; add any missing entries from 06 S0 to it in a chore commit.
- The Stop hook stays inactive until package.json has both "test" and "typecheck" scripts. Add both in the first scaffold commit, with "test" running `vitest run` (never watch mode).
- Before writing package.json, look up the current release of every package S0 needs (06 S0, 05 §3, 03 §5) from npm or the project's site. Put the list in the plan with versions and sources. Pin them exactly. Use only packages those docs name; if S0 seems to need another, stop with BLOCKED:.
- Vitest 5 needs Node 22.12+ and Vite 6.4+. If Vitest 5 breaks the canary component test, fall back to Vitest 4.1 pinned, say so in the commit body, and tell me so I can log the amendment (D-055).
- Husky: pre-commit runs lint-staged only; commit-msg runs commitlint and then `node scripts/check-commit-shape.mjs "$1"`. .husky/ is a protected path, so expect a permission prompt there.
- Render, Turso and GitHub settings need my accounts. Write render.yaml and a short checklist of what I must click (Turso region nearest Singapore, env vars, branch protection, merge settings), then stop with BLOCKED: until I confirm each is done.
```

### Why S0 differs from the template
- No `package.json` means no tests yet, so the first commits are `chore` scaffolding, and the Stop hook has nothing to run until the scripts exist.
- Version lookups are the agent's job here because pinned versions are a decision the reviewers can see in the S0 commit body.
- Account-bound steps (Render, Turso, GitHub settings) can't be done from the terminal, so the prompt makes the agent hand them back explicitly instead of guessing.

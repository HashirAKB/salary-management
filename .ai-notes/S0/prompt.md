/tdd-slice S0
This is the bootstrap slice. The repo has docs/, CLAUDE.md, .claude/, scripts/check-commit-shape.mjs and .gitignore, and no package.json.
- .gitignore is already committed, so drop 06's "chore: ignore .ai-notes..." commit; add any missing entries from 06 S0 to it in a chore commit.
- The Stop hook stays inactive until package.json has both "test" and "typecheck" scripts. Add both in the first scaffold commit, with "test" running `vitest run` (never watch mode).
- Before writing package.json, look up the current release of every package S0 needs (06 S0, 05 §3, 03 §5) from npm or the project's site. Put the list in the plan with versions and sources. Pin them exactly. Use only packages those docs name; if S0 seems to need another, stop with BLOCKED:.
- Vitest 5 needs Node 22.12+ and Vite 6.4+. If Vitest 5 breaks the canary component test, fall back to Vitest 4.1 pinned, say so in the commit body, and tell me so I can log the amendment (D-055).
- Husky: pre-commit runs lint-staged only; commit-msg runs commitlint and then `node scripts/check-commit-shape.mjs "$1"`. .husky/ is a protected path, so expect a permission prompt there.
- Render, Turso and GitHub settings need my accounts. Write render.yaml and a short checklist of what I must click (Turso region nearest Singapore, env vars, branch protection, merge settings), then stop with BLOCKED: until I confirm each is done.
- Add an .nvmrc containing 22 and an "engines": { "node": ">=22.12" } entry in package.json, so local, CI and Render all use the same Node version.

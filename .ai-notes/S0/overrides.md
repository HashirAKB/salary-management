# S0 overrides

## 1. Node version (planning, before any commit)
- What I did: flagged that the slice note (.nvmrc `22`, engines `>=22.12`) contradicts D-062 (Node 24, `>=24.0.0 <25`) and that current deps need Node 22.22.2+.
- What you said: "Node 24 per D-062".
- What changed: `.nvmrc` = `24`, engines `>=24.0.0 <25`; nvm default switched to 24. The note's Node 22 line is not followed.
- Commit affected: the scaffold commit (`chore: scaffold npm workspaces and TypeScript project references`).

## 2. Undocumented supporting packages (planning)
- What I did: stopped with BLOCKED: on typescript-eslint, @types/node, @types/react, @types/react-dom, @mantine/hooks (not named in docs).
- What you said: "Amend the docs first and then do it. Approved."
- What changed: a docs commit adds amendment A-007 before the scaffold, then the packages are installed.
- Commit affected: `docs(docs): name the supporting packages s0 needs` and the scaffold/lint/vitest chore commits.

## 3. Version choices (planning)
- You chose msw 2.15.0 over 3.0.2 and react 19.2.8 over 19.3.0, and the placeholder page fetching /api/health ("Heading + API status").

## 4. Self-reported slip (cycle E)
- What happened: red commit e91da95 (`test(api): report health when the database answers`) was committed although `npm run typecheck` reported TS2339 (`$client` missing on `Db`); the commit wasn't chained on typecheck.
- What changed: green commit 9bb7333 types `Db` as `LibSQLDatabase & { $client: Client }` and says so in its body. All later commits are chained on typecheck with `&&`.

## 5. GitHub settings done by Claude (after the slice)
- What I did: said the GitHub, Render and Turso steps were yours.
- What you said: "Why can't you do these?", then "do the github stuff".
- What changed: Claude set the repository settings with `gh api`: merge commits only (squash and rebase off), and protection on `main` (PR required with 0 approvals, required check `verify`, force pushes and deletions blocked, linear history off, enforce_admins off). The repo was already public with `main` as the default branch. D-068 was not lifted, so you still push and open the PR.
- Commits affected: none (repository settings only).

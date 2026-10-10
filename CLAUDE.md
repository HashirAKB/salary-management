# ACME Salary Manager

The spec lives in `docs/`. Find the current slice in `docs/06-build-plan.md` and read only the docs it links. API and UI contract: `docs/04-api-and-ui.md`. Test rows: `docs/05-test-strategy.md`. Schema and money: `docs/02-data-model.md`. Decisions: `docs/adr/`.

## Commands
- `npm test`: all tests (Vitest). One project: `npm test -- --project api` (or `web`, `shared`)
- `npm test -- <path>`: one file; prefer this while iterating
- `npm run lint && npm run typecheck`; `npm run build`; `npm run dev`
- `npm run test:coverage`: what CI runs; enforces the coverage floor on `domain/` and `shared/`
- `npm run seed`: 10,000 employees, deterministic; needs `DEMO_HR_ADMIN_PASSWORD`, `DEMO_HR_VIEWER_PASSWORD`, `DEMO_FINANCE_PASSWORD`
- `npm run e2e`: Playwright smoke test against the built app
- `npm run eval`: Ask eval against the real model. Manual only, needs `ANTHROPIC_API_KEY`, never in CI
## Rules
- IMPORTANT: test first. Write a failing test, run it, see it fail, write the minimum code to pass, refactor only on green. Build slices with `/tdd-plan S<n>` (Opus, plan mode) then `/tdd-build S<n> <cycles>` (Sonnet, effort medium, one cycle group per session) then `/tdd-finish S<n>` (Sonnet). Use `/clear` between sessions; never switch model mid-session. Build sessions read `.ai-notes/Sn/brief.md`, not `docs/04` or `docs/05` directly.
- When compacting mid-session set `/compact` focus to: current slice, branch, open cycles, ticked test rows, last commit hash, and any BLOCKED: questions.
- Commit after each step, as Conventional Commits `type(scope): subject`, lower case, under 72 characters:
  - red `test(scope)`: tests plus `throw new Error('not implemented')` stubs. Green `feat(scope)` or `fix(scope)`: production code only. `refactor(scope)`: tests unchanged and green. Config and wiring: `chore`, `build`, `ci`.
  - Scopes: api, web, shared, db, seed, auth, employees, salary, insights, export, ask, e2e, deploy, docs.
  - Small commits, explicit paths. Never `--no-verify`, `--amend`, force push or squash.
- Any change touching more than one file: write the plan and wait for approval before editing.
- Never make a product or scope decision. If `docs/` is silent or ambiguous, stop and ask: start your reply with `BLOCKED:`, quote the doc section, give the options. Don't edit `docs/` unless I ask.
- A Stop hook runs `npm test` and `npm run typecheck` when you end a turn and sends you back if either fails. Fix the cause; never skip, weaken or delete a test to get past it. `BLOCKED:` is the only way to stop on a red tree.
- Money is integer minor units plus ISO currency code, `{ amountMinor, currency }`, in the DB, services, JSON and props; never floats, never `REAL`. Convert to USD per employee (integer `usd_per_unit_micros`, half up to the cent), then sum, average or take percentiles; never convert an aggregate. Format money only in the web `Money` component.
- No new dependency unless `docs/` names it (an ADR, 03 section 5, 05 section 3 or 06). Pin exact versions.
- `.ai-notes/` is git-ignored and committed once, by hand, at the end. Prompts, test lists, reviews and override notes go there. Never `git add` or commit anything in it.
## When compacting
Keep the current slice and branch, files changed, failing tests, the test list with rows marked done or open, every commit hash from this session, open `BLOCKED:` questions, and every correction I gave you.

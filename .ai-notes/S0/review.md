# S0 spec review (spec-reviewer, verbatim)

### Spec review: S0
Verdict: PASS

Checked: every 05 §5.0 row that S0 owns has a matching test that the code satisfies.
- `ROUTE_NOT_FOUND` 404: tested with and without static serving.
- Static `index.html` fallback: uses a temporary dist folder.
- 415 `UNSUPPORTED_MEDIA_TYPE`.
- 500 `INTERNAL` with no stack trace: uses a test-only route.
- Health 200 `{ status: "ok" }`, plus a 503 `DB_UNAVAILABLE` test.
- Config: rejects a missing `DATABASE_URL` and lists every invalid variable.
- Problem builder: `type: about:blank` and the status phrase as `title`.
- Zod errors become `errors[]` with dot-joined paths.
- Canary component test: renders the placeholder through the test wrapper with an MSW handler.

The other S0 work matches its spec:
- **03 §8 config:** defaults are right and the token is required in production.
- **04 §4.1 / §4.4 / §5.1:** `trustProxy` is on, and the status codes, problem codes and `application/problem+json` content type match the catalogue. The 500 body contains no internal detail.
- **04 §8.1:** `@fastify/static` uses `wildcard: false`, and the not-found handler sends `index.html` for non-API paths and a problem for everything under `/api`.
- **05 §3.1:** the Vitest projects, setup files, MSW `onUnhandledRequest: 'error'`, `TZ=UTC` and D-052 coverage thresholds match the documented config shape.
- **D-051 and ADR 0004:** the lint rules ban `new Date()`, `Date.now()` and `Math.random()` outside the clock module, and `domain/` can't import from `db/`, `http/`, `modules/` or `node:*`.
- **06 §3.4 CI, D-062 Node 24, render.yaml fields, A-007 packages:** all as specified; versions are pinned exactly.
- **Commits:** every behaviour has a `test(...)` commit before its `feat(...)` (config, clock, problem, error handler, health, web, static). The expected 06 commit subjects are all there. The `commit-msg` hook rejects `feat`/`fix` commits that touch `*.test.*` files. No route in this diff needs a `requires(...)` guard or an access-matrix row: the guard arrives in S2 (D-056), and 04 §5.0 marks health as public.

Not checked:
- **What each commit contains:** I can't run `git show`, so I couldn't confirm that each red commit held only tests and stubs, or that `feat` commits didn't change non-`*.test.*` helpers such as `apps/api/test/helpers.ts`.
- **Acceptance criteria that need a running system:** `npm ci && npm test` on a fresh Node 24 clone, CI not running on a red branch push, `verify` going green on the pull request, the deploy on merge, the live `/api/health` answering within a minute of a cold start, and the D-067 kit commit coming before the first S0 commit. These all need the repo run, GitHub or Render.
- **Branch protection and merge settings (06 §3.3) and the Turso database:** these are set outside the repo.

Two departures from the 06 S0 text, neither a finding:
- `render.yaml` uses `npm ci --include=dev`. Without it, `NODE_ENV=production` would make `npm ci` skip `tsc` and `vite` and the build would fail.
- `actions/*@v7` follows 06's rule to pin actions to the current major at S0.

---

## Proposed actions (Claude)

No findings, so there is nothing to fix. On the reviewer's "Not checked" items:
- **Commit contents:** checked with `git show --name-only` for every test/feat commit. Red commits hold only tests, the test helpers and fixtures, `not implemented` stubs, and type-only additions (the `staticRoot?` field in 0678d38, the shared index export in e91da95). Green commits touch no `*.test.*` file and nothing under `apps/*/test/`. One known slip: e91da95 didn't typecheck when it was committed (see overrides.md §4).
- **Fresh clone on Node 24:** `rm -rf node_modules && npm ci && npm test` passed on Node 24.21.0 (7 files, 23 tests).
- **CI on red pushes, `verify` on the PR, deploy on merge, live health after a cold start, branch protection and merge settings:** these are yours to check after pushing.
- **D-067 kit commit:** it comes before the first S0 commit, but its subject reads `chore: add Claude Code kit`, not 06's `chore: add claude code kit and gitignore`.

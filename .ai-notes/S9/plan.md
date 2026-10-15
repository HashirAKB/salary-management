# S9 plan (approved 2026-10-11)
Branch `s9-deploy-hardening`. Docs commit `1e02aff docs(deploy): add chat 8 deploy, perf and demo decisions`.
Spec: `brief.md`. Tests: `test-list.md`.

## B1: cycles A–C (web waking work, 05 §5.9 C rows 2–5)
### A. Waking banner (3 tests)
Files: `apps/web/src/api/client.ts`, new `apps/web/src/api/connection.ts` (external store, injected scheduler; states ok | slow | waking | down), new `apps/web/src/components/ServerStatusBanner.tsx` (+ test), `apps/web/src/components/Shell.tsx`, `apps/web/src/api/client.test.ts`.
- red  `test(web): show the waking banner for slow and non-json responses`
- green `feat(web): add connection store and server status banner`
### B. Health poll, GET retry, writes not retried (3 tests)
Files: `client.ts`, `connection.ts`, `queryClient.ts` (+ test), `features/employees/SalaryChangeModal.tsx` (+ test: "may not have been saved" message).
- red  `test(web): retry gets after the server wakes and never retry writes`
- green `feat(web): add waking detection to the api client`
### C. Server down + Try again (2 tests)
Files: `connection.ts`, `ServerStatusBanner.tsx` (+ tests).
- red  `test(web): show server down after 90 seconds of failed polls`
- green `feat(web): add server down state with try again`

## B2: cycle D + CI (Cut 3 removes this whole session)
1. `build(e2e): add playwright config with seeded database` — `@playwright/test` exact pin, `playwright.config.ts` (Chromium, `webServer` = `node apps/api/dist/main.js` with `DATABASE_URL=file:./e2e/.data/e2e.db`, test-only DEMO_* passwords), `e2e/global-setup.ts` (runs real seed CLI), `npm run e2e` (build, seed, playwright), eslint/tsconfig coverage for `e2e/`. Vitest projects are rooted in packages/apps so `e2e/` is not picked up.
2. `test(e2e): log in, filter, record a raise and see the role differences` — `e2e/smoke.spec.ts`, 05 §5.10 steps 1–5. Expected green on first run (features exist); no red step.
3. `ci: run the smoke test after verify` — `e2e` job in `.github/workflows/ci.yml`: needs verify, installs Chromium, runs `npm run e2e`; under 2 min.

## R: finish
- lint, typecheck, test:coverage, build, spec-reviewer.
- Branch protection requiring `e2e`: GitHub settings change — ask Hashir before running `gh api`, or he sets it.
- 08 §5 live checklist (7 rows): Hashir runs it (Render dashboard, prod Turso creds, DEMO_*; `.env` read is denied). Recording results / cold-start seconds in `docs/08` only if he asks.

## Acceptance → proof
| Criterion | Proof |
| Smoke test passes in CI | green `e2e` job; branch protection requires it |
| After spin-down: banner then data, no error page | cycles A–C tests; live: 08 §5 rows 3 and 7 (manual) |

## Deviations from 06 expected commits (approved)
- Extra red/green pair for cycle C.
- `build(e2e)` before `test(e2e)`; smoke has no red step.
- `queryClient` stops retrying `ServerWakingError` (04 §8.3 "the waking logic owns transport retries").

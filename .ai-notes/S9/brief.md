# S9 brief: Deploy hardening and smoke test
Branch `s9-deploy-hardening`. Spec excerpts only; if silent, stop with `BLOCKED:`.

## Goal and acceptance (06 S9)
Goal: "The live link survives cold starts and reviewer use, and one automated test proves the built app works."
Acceptance: "The smoke test passes in CI; on the live URL, a request after spin-down shows the banner and then the data, with no error page."
Scope (06 S9, updated Chat 8): "Web: connection store with injected scheduler, `ServerStatusBanner`, waking detection and GET retry in the API client (D-045). Playwright config with `webServer` and `globalSetup` running the seed; `e2e/smoke.spec.ts` (05 section 5.10); `e2e` CI job; branch protection requires `e2e`." and "Live checks from `08-deploy-perf-demo.md` §5: env vars, `trustProxy` IP in logs, sleeping `/api` form, cold-start time, one manual seed reset, portable SQL smoke, waking banner."
Cut 3: everything under `e2e` (the waking work stays).

## D-045 (04 section 1)
"The web API client detects a sleeping server: a request pending over 4 seconds, a non-JSON response to an `/api` call, a 502, 503 or 504 without a problem body, or a network error. It shows a "waking the server" banner, polls `GET /api/health` every 3 seconds for up to 90 seconds, then retries GETs once. Writes are never retried automatically." Reason: "Retrying a write could save it twice."
ADR 0002: one Render free service, same origin; waking state not needed for the first visit, "still needed when a tab outlives the 15-minute idle window".

## A1 health (04 section 5.1)
`GET /api/health`, no auth. 200 `{ "status": "ok" }`; 503 `DB_UNAVAILABLE` problem. "Used by the waking logic (D-045) and Render's health check."

## 04 section 8.2 Global states (rows for S9)
| Waking (D-045) | See 8.3 | Yellow banner under the header: "Waking the server. Free hosting sleeps after 15 minutes without use; this can take up to a minute." Content stays visible |
| Server down | Waking lasted 90 seconds | Red banner: "The server isn't responding." with a "Try again" button that restarts the health poll |

## 04 section 8.3 Data fetching rules (verbatim)
- "Waking detection (D-045): a 4-second timer on each request sets the connection store to `slow` (shows the waking banner). A network `TypeError`, a 502, 503 or 504 without `application/problem+json`, or any non-JSON response to an `/api` call raises `ServerWakingError` and sets the store to `waking`. The store then polls `GET /api/health` every 3 seconds; on a 200 JSON response it returns to `ok`, and GETs that failed are retried once. After 90 seconds it moves to `down`. A write that hit `ServerWakingError` is not retried; the form shows "The server was waking up, so your change may not have been saved. Check the page and try again.""
- "The connection store is a tiny external store read with `useSyncExternalStore` by `ServerStatusBanner`."
- TanStack Query "`retry`: never for `ApiError` (4xx and 5xx with a problem body are final); the waking logic owns transport retries."
- Placement (04 section 2): `web/src/components/ServerStatusBanner.tsx`. Client: `apps/web/src/api/client.ts`.

## 05 rows owned (verbatim)
5.9 (C rows 2 to 5):
- C | a request pending over 4 seconds shows the waking banner (manual scheduler)
- C | a non-JSON or 503 response without a problem body starts the health poll; a 200 health response hides the banner and the failed GET is retried once
- C | a write that hits a waking server is not retried and shows the "may not have been saved" message
- C | after 90 seconds of failed polls the banner says the server isn't responding, with "Try again"

5.10 End to end: "`e2e/smoke.spec.ts`, Chromium, against `npm run build` plus `node apps/api/dist/main.js` with `DATABASE_URL=file:./e2e/.data/e2e.db`. Playwright's `globalSetup` runs the real seed CLI first with test-only demo passwords from the Playwright config, so the run also proves the seed and the production start command."
One test, in order:
1. Log in as HR Admin; land on `/employees`; the toolbar shows 10,000 employees.
2. Filter Country India, Job title Software Engineer, Level L3; the URL carries the filters; the toolbar shows 280.
3. Open the first employee; record a merit increase of 5% dated today.
4. The toast appears and the history's top row is "Merit increase" with `+5.0%`.
5. Log out; log in as Finance; land on `/insights`; the nav has no "Employees".
"Not covered by E2E: Ask (no key in CI), pay equity and export."

## Tooling (05 sections 3, 4)
- "`@playwright/test`, Chromium only | One smoke test | `webServer` starts the built app" (pin exact version).
- "`npm run e2e` | Builds, seeds an e2e database, runs Playwright | Under 2 minutes in CI".
- `e2e/.data/` is already git-ignored. CI: `.github/workflows/ci.yml` has "# e2e job added in S9: needs verify, installs Chromium, runs npm run e2e".
- Seed needs `DEMO_HR_ADMIN_PASSWORD`, `DEMO_HR_VIEWER_PASSWORD`, `DEMO_FINANCE_PASSWORD`.

## Live checks (08 §§1, 3, 5) — manual, R session, run by Hashir
08 §1: "Accept Render free cold starts. Warn in the README. No keep-warm ping or cron." "Demo reset is the existing seed CLI, run by hand against production Turso." 08 §5: "Observations and one manual seed. Product code for S9 remains the waking client, banner and Playwright smoke (06 S9); this list does not add features."
| # | Check | How | Record |
| 1 | Env vars on Render | Dashboard: `DATABASE_*`, `NODE_ENV`; Ask key if demoing Ask | tick |
| 2 | `trustProxy` hop 0 | One login; confirm the logged `request.ip` is a client address, not Render's proxy (04 §11 Q2) | IP shape seen |
| 3 | Sleeping `/api` response | Idle past 15 min (or restart); trigger a GET; note held request, HTML page, or bare 5xx (04 §11 Q1) | which form observed |
| 4 | Cold-start wall time | From spun-down, time until `GET /api/health` returns 200 | seconds |
| 5 | Demo reset | Run §4 (`npm run seed` with prod `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, DEMO_*) once; log in; ~10,000 active employees | tick |
| 6 | Portable SQL on live Turso | Employee list and one insights view load without SQL errors | tick |
| 7 | Waking banner | After spin-down, next in-app GET shows yellow banner, then data, no error page | tick |
"Cold-start wall time (S9 fill-in): _____ s." (08 §5) Out of scope (08 §9): keep-warm, reset endpoint, `docs/performance.md`.

## Money
No new money logic. The e2e asserts `+5.0%` (04 section 8.4.1 change % format).

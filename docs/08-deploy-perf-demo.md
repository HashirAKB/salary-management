# 08 Deploy, performance and demo

Chat 8 output. Confirms hosting, cold-start policy and demo reset; gives S9 its live checklist, S10 the performance and video scripts.
Inputs: `decisions.md`, `03-architecture.md` §10, `02-data-model.md` §7.10, `04-api-and-ui.md` §§8.2–8.3 and 11, `06-build-plan.md` S9–S10, ADR 0002, `render.yaml`.

## 1. Decisions

| # | Decision | Why | Rejected |
| --- | --- | --- | --- |
| 1 | Accept Render free cold starts. Warn in the README. No keep-warm ping or cron | Reviewers expect a free-tier take-home; D-045 covers a tab left open past the 15-minute idle window; a warm ping would burn most of the 750 free instance hours | Scheduled ping every 10–14 minutes; paid always-on |
| 2 | Demo reset is the existing seed CLI, run by hand against production Turso | Same deterministic dataset the tests and video rely on (D-026); no new endpoint to secure; Turso free plan allows occasional resets | Daily cron reset; public reset URL; never reset |
| 3 | Hosting as built: one Render free web service in `singapore`, Turso free DB, `autoDeployTrigger: checksPass` (D-005, D-030, D-061, D-063, ADR 0002) | Already live from S0; Chat 8 confirms rather than redesigns | Separate static site; Oregon region; first deploy only in S9 |

## 2. Hosting (confirmed)

One Render free web service (`render.yaml`):

- `plan: free`, `region: singapore`, `runtime: node` (Node from `.nvmrc`, D-062).
- Build: `npm ci --include=dev && npm run build`. Start: `node apps/api/dist/main.js`.
- `healthCheckPath: /api/health`. `autoDeployTrigger: checksPass`.
- Fastify serves `/api/*` and the Vite build, with an SPA fallback (ADR 0002).
- Database: Turso free plan via `DATABASE_URL` and `DATABASE_AUTH_TOKEN` (`sync: false` in the blueprint). Region: as created in S0 (closest Turso region to Singapore at the time).

Env vars on the live service (03 §8):

| Variable | Required on Render |
| --- | --- |
| `NODE_ENV=production` | yes (blueprint) |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | yes |
| `ASK_PROVIDER`, `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`, optional `ASK_MODEL` | only if the live demo shows Ask (D-004) |
| `DEMO_HR_ADMIN_PASSWORD`, `DEMO_HR_VIEWER_PASSWORD`, `DEMO_FINANCE_PASSWORD` | not read by the API; needed on the machine that runs the seed reset |
| `PORT`, `LOG_LEVEL`, Ask daily limits | optional (defaults apply) |

Secrets stay in Render's dashboard and a local git-ignored `.env`. Never commit them.

## 3. Cold starts

- After about 15 minutes without traffic the free instance sleeps. The first browser visit shows Render's own loading page (about a minute). The app needs no waking UI for that case.
- A tab left open past the idle window hits a sleeping instance on the next `/api` call. The client shows the waking banner, polls `GET /api/health`, and retries GETs once (D-045, 04 §8.3). Writes are never retried.
- No keep-warm mechanism. The README states that the first load after idle can take up to about a minute.
- Render's 750 free instance hours a month are enough for intermittent reviewer use without a warm ping.

## 4. Demo reset

When to run: before recording the demo video, or when a reviewer has changed the seeded world enough that counts, gaps or the smoke path no longer match the deterministic dataset.

From a machine that can reach Turso (local clone is fine):

```bash
# Use the production Turso URL and token, and the same DEMO_* passwords as Render.
export DATABASE_URL='libsql://…'
export DATABASE_AUTH_TOKEN='…'
export DEMO_HR_ADMIN_PASSWORD='…'   # ≥ 12 chars
export DEMO_HR_VIEWER_PASSWORD='…'
export DEMO_FINANCE_PASSWORD='…'
npm run seed
```

Behaviour (02 §7.10): clears `ask_log` and `sessions`, deletes and re-inserts domain tables, upserts the three demo users by email. Running twice leaves identical domain data.

Cost: about 52,000 rows written per reset; deletes count too, so roughly 100,000 row-writes against Turso's free plan (10 million rows written per month). Occasional manual resets stay well inside the budget. No scheduled job and no reset HTTP route.

## 5. S9 live checklist

Observations and one manual seed. Product code for S9 remains the waking client, banner and Playwright smoke (06 S9); this list does not add features.

| # | Check | How | Record |
| --- | --- | --- | --- |
| 1 | Env vars on Render | Dashboard: `DATABASE_*`, `NODE_ENV`; Ask key if demoing Ask | tick |
| 2 | `trustProxy` hop 0 | One login; confirm the logged `request.ip` is a client address, not Render's proxy (04 §11 Q2) | IP shape seen |
| 3 | Sleeping `/api` response | Leave the tab idle past 15 minutes (or restart the service); trigger a GET; note held request, HTML page, or bare 5xx (04 §11 Q1). D-045 already handles all three | which form observed |
| 4 | Cold-start wall time | From a spun-down service, time until `GET /api/health` returns 200 | seconds (fill here after S9) |
| 5 | Demo reset | Run §4 once against live Turso; log in and confirm ~10,000 active employees | tick |
| 6 | Portable SQL on live Turso | After deploy: employee list page and one insights view load without SQL errors (03 §13 Q5 / D-025) | tick |
| 7 | Waking banner | After spin-down, next in-app GET shows the yellow banner, then data, with no error page (06 S9 acceptance) | tick |

Cold-start wall time (S9 fill-in): _____ s.

## 6. Performance measurement (S10)

Run in S10; write real numbers to `docs/performance.md`. Do not invent timings in this file.

Script outline (local file DB and/or production Turso, 10,000 active employees):

1. Seed once.
2. Time the default employee list page (`page=1`, `pageSize=50`, no filters). F2 budget under 300 ms locally.
3. Time one insights request that loads up to 10,000 active rows (target under 500 ms, 04 §11 Q3).
4. Time list sort by salary in USD (02 §10 Q7). Expected to stay in budget without a stored USD column.
5. If practical, compare with indexes temporarily dropped; otherwise note "indexes on" only.
6. Optional: first Ask call latency on the live service (grammar / cold model path) against the 15-second timeout (04 §11 Q4).

Fallback if insights miss the budget: an in-process cache of the active projection, cleared on every employee or salary write (04 §11 Q3). Do not build it unless measurement says so.

## 7. Demo video script (3 to 5 minutes)

Record from the live URL after a fresh §4 reset. Say the cold-start warning once if the first load is slow.

1. Open the live URL; land on login. Mention free hosting may sleep after 15 minutes idle.
2. Log in as HR Admin (`hr.admin@acme.test`). Land on `/employees`; toolbar shows about 10,000 employees.
3. Filter Country India, Job title Software Engineer, Level L3; URL carries the filters; toolbar shows the seeded cohort count.
4. Open the first employee; record a merit increase of 5% dated today; toast appears; history top row is "Merit increase" with `+5.0%`.
5. Open Insights; show a payroll or distribution figure and the FX as-of date.
6. Open Pay equity; point at a flagged cohort (gap at or above 5%).
7. Log out; log in as Finance (`finance@acme.test`). Land on `/insights`; nav has no "Employees".
8. Optional, if an Ask key is set: Ask "What is the median pay for a Senior Engineer in India?" (eval q01); show the answer and "How I read your question".
9. Close: live link in the README, three demo accounts, and that `npm run seed` against Turso restores the known dataset after reviewer edits.

Not in the video: CSV export deep dive, Ask without a key, Playwright.

## 8. Acceptance for this file

- [x] Cold start, demo reset and hosting confirmed with rejected alternatives.
- [x] S9 live checklist is concrete enough to run without guessing.
- [x] S10 has a performance outline and a timed demo script.
- [x] No new product surface beyond what 02/03/04/06 already specified.

## 9. Out of scope

- Implementing the waking client or Playwright (S9).
- Writing `docs/performance.md` or recording the video (S10).
- Keep-warm infrastructure, paid Render, or an automated reset endpoint.

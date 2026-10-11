# ACME Salary Manager

> ## 🎥 [Watch the demo video (3 to 5 minutes)](https://www.youtube.com/watch?v=-_ylLd3blpA)
>
> All three roles, the salary history, pay equity and Ask about pay.

A web app that replaces the Excel files an HR team uses to manage salaries for 10,000 employees across several countries. HR keeps salary data correct, records raises with a full history, and answers "how do we pay people?" in seconds, including in plain English.

**Live:** https://acme-salary-r5qq.onrender.com/

The live app runs on free hosting and sleeps when idle. The first load after a quiet spell takes about 30 seconds; after that it is fast.

## Contents

- [Demo accounts](#demo-accounts)
- [Run it locally in five minutes](#run-it-locally-in-five-minutes)
- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [How I worked with AI](#how-i-worked-with-ai)
- [Demo video, made as code](#demo-video-made-as-code)
- [How to read the history](#how-to-read-the-history)
- [Not built](#not-built)

## Demo accounts

| Role      | Email                 | Password          | Can do                                            |
| --------- | --------------------- | ----------------- | ------------------------------------------------- |
| HR Admin  | `hr.admin@acme.test`  | `AdminPass123!`   | Read and edit everything                          |
| HR Viewer | `hr.viewer@acme.test` | `ViewerPass123!`  | Read everything, no edits                         |
| Finance   | `finance@acme.test`   | `FinancePass123!` | Aggregates only: no names, no individual salaries |

The live data can be edited by anyone with these accounts. If it drifts, `npm run seed` restores a local copy.

## Run it locally in five minutes

You need Node 24 (the repo has an `.nvmrc`).

```
nvm use
npm ci
cp .env.example .env
```

Edit `.env` and set at least:

```
DATABASE_URL=file:./data/dev.db
DEMO_HR_ADMIN_PASSWORD=<choose one>
DEMO_HR_VIEWER_PASSWORD=<choose one>
DEMO_FINANCE_PASSWORD=<choose one>
```

Then:

```
npm run seed    # 10,000 employees, deterministic
npm run dev     # web on http://localhost:5173, API on :3000
```

Log in with the emails above and the passwords you chose. "Ask about pay" needs `GEMINI_API_KEY` (or `ASK_PROVIDER=anthropic` with `ANTHROPIC_API_KEY`). Without a key the feature is hidden and everything else works.

Other commands: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:coverage`, `npm run perf`.

## What it does

- **HR Admin and HR Viewer:** search and filter the employee list (country, department, job title, level, gender, status, outside band, no salary change since a date), with filters kept in the URL; open an employee to see band position, compa-ratio and the full salary history; export the filtered list to CSV.
- **HR Admin only:** add, edit and terminate employees; record a salary change (promotion, merit, market adjustment, correction) with the reason, who and when kept in history.
- **Insights:** payroll and headcount by country, P25, median, P75, min, max and average by country, department, job title and level.
- **Pay equity:** gender pay gap per country, job title and level cohort, flagged at 5% or more. A cohort needs at least 5 women and 5 men to show numbers.
- **Finance:** insights and pay equity only, and never a group of fewer than 5 people.
- **Ask about pay:** a plain-English question becomes a structured query that the same insights service runs, so role rules still apply. The interpreted query is shown beside the answer.

## How it works

TypeScript throughout: a Fastify API, a React and Mantine web app, and a shared package of types and validation. One deployable serves both from one origin, on SQLite through libSQL (a local file in development, Turso in production).

- Requirements, scope and what was left out: [docs/01-requirements.md](docs/01-requirements.md)
- Data model and money rules: [docs/02-data-model.md](docs/02-data-model.md)
- Architecture: [docs/03-architecture.md](docs/03-architecture.md)
- API and UI contract: [docs/04-api-and-ui.md](docs/04-api-and-ui.md)
- Test strategy: [docs/05-test-strategy.md](docs/05-test-strategy.md)
- Build plan, one slice at a time: [docs/06-build-plan.md](docs/06-build-plan.md)
- Deploy, performance and demo plan: [docs/08-deploy-perf-demo.md](docs/08-deploy-perf-demo.md)
- Every decision with its alternatives: [docs/decisions.md](docs/decisions.md) and the [ADRs](docs/adr/)
- Ask about pay eval, run against the real model: [docs/evals/ask-eval-2026-10-11.md](docs/evals/ask-eval-2026-10-11.md)

Choices worth knowing:

- **Money is never a float.** Every amount is an integer in minor units plus an ISO currency code. Cross-country figures convert to USD per employee with a static, dated FX table (the as-of date is shown beside every converted number), then sum, average or take percentiles.
- **Permissions are enforced on the API**, with a test for every route and role, not hidden in the UI.
- **Ask about pay never writes SQL.** The model only fills a structured query, which keeps it testable and inside the permission model.
- **Performance is measured, not assumed.** At 10,000 employees every list and insights request is well under its budget, with and without indexes. See [docs/performance.md](docs/performance.md) for the numbers, machine and method.

## How I worked with AI

I used Claude Code throughout, and tried to keep myself in charge of decisions.

- **Spec first.** The requirements, data model, API contract, test strategy and build plan were written and committed before the code. Claude was told never to make a product or scope decision: when the docs were silent it stopped and asked.
- **One slice per session.** Each slice was planned in plan mode, then built in a fresh session with a small brief, then finished with a review.
- **Red, then green.** Tests are committed failing first, then the code that makes them pass. Hooks block force pushes and `--no-verify`, and run the tests and typecheck before a session may end.
- **A second reader.** A separate `spec-reviewer` agent checks each finished slice against the spec, looking for gaps in correctness and role permissions.
- **My corrections are recorded.** When I overrode Claude, the override was written down per slice.
- **The AI feature is evaluated.** A fixed set of 15 questions runs against the real model; the bar is 13 of 15.

The prompts, test lists, reviews, overrides and usage log are in [.ai-notes/](.ai-notes/).

## Demo video, made as code

The demo video was not screen-recorded by hand. While building this app I wrote [**talkies**](https://github.com/HashirAKB/talkies), a small open-source command-line tool that turns Playwright scene scripts into a narrated product video. It gives the cursor a gliding pointer and click ripples so viewers can follow along, cuts spinners and dead air automatically, voices each scene with AI text-to-speech, and fits each scene to its narration so audio and video stay in sync, all with no hand editing. A retake is one command (`talkies take`), so the video can be regenerated whenever the UI changes. It also ships as an agent skill: in Claude Code (or Cursor and Codex) you can ask for "a demo video of the app" and the agent writes the scenes, records the take and checks the result before handing it over.

## How to read the history

```
git log --oneline --graph
```

Each slice is a branch merged by one pull request. Inside a branch, `test(...)` commits are the failing tests, `feat(...)` and `fix(...)` commits make them pass, and `refactor(...)` commits change structure only. Nothing is squashed or amended.

## Not built

- **Playwright smoke test** (cut 3 in [docs/06-build-plan.md](docs/06-build-plan.md) section 4.1). I dropped it to protect the deployment and the demo. The cost: no automated check of the built bundle. The unit, API and component tests run in CI, and I checked the live deployment by hand after each deploy.
- Everything under "Out of scope" in [docs/01-requirements.md](docs/01-requirements.md), such as net pay, bonuses and equity, CSV import, approval workflows, country transfers, editable pay bands and SSO.

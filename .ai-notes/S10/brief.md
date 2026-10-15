# S10 brief: README, performance note, demo, AI notes

Overrides P1-P9 in `overrides.md` amend the doc excerpts below. Where they disagree, overrides.md wins.

## 06 S10 (verbatim, trimmed)
**Goal.** A reviewer can understand, run and judge the submission in five minutes.
**Scope.**
- Performance script: list and insights timings at 10,000 rows with and without the indexes, written to `docs/performance.md` with the real numbers.
- README: what it is and the live link with the cold-start note; demo accounts; five-minute local setup (`nvm use`, `npm ci`, `.env`, `npm run seed`, `npm run dev`); how it works, with links to `docs/`; how AI was used; how to read the history (`git log --oneline --graph`); "Not built" section for any applied cuts.
- Review `.ai-notes/` and commit it once (D-007). **(P9: the user commits it by hand. Never stage .ai-notes/.)**
- Record the 3 to 5 minute demo and link it.
**Test list.** None (docs only). The full suite and the live smoke check are re-run before the final commit.
**Acceptance.** A fresh clone following the README reaches a running app with seeded data; every link in the README works; no em dash characters in the README or docs.

## Facts
- Live URL: https://acme-salary-r5qq.onrender.com/
- Cold start (P10): the user measured about 30 s. The README says the first load after idle takes about 30 seconds.
- Demo users (apps/api/src/seed/cli.ts): `hr.admin@acme.test`, `hr.viewer@acme.test`, `finance@acme.test`. The passwords come from the `DEMO_*` env vars. P11: print all three in the README, and ask the user for the live values (never read .env).
- Setup files: `.nvmrc`, `.env.example`.
- Applied cuts: cut 3, the Playwright smoke test (06 §4.1: "No automated check of the built bundle; S9's manual live check remains"). There is no `npm run e2e`.
- Indexes (0001_init.sql:112-120): ix_employees_status_name, ix_employees_cohort, ix_employees_title_level, ix_employees_salary_date, ix_employees_hire_date, ix_salary_changes_employee, ix_sessions_user, ix_ask_log_user_time, ix_ask_log_time.
- Brief "How to Succeed": clear thinking and structured problem solving; thoughtful architecture and design decisions; clean, maintainable code; meaningful tests; intentional use of AI tools; evidence of product thinking. "We are not looking for the most complex system, but for good engineering judgment."

## 08 §6 Performance (verbatim)
Run in S10; write real numbers to `docs/performance.md`. Do not invent timings.
1. Seed once.
2. Time the default employee list page (`page=1`, `pageSize=50`, no filters). F2 budget under 300 ms locally.
3. Time one insights request that loads up to 10,000 active rows (target under 500 ms, 04 §11 Q3).
4. Time list sort by salary in USD (02 §10 Q7). Expected to stay in budget without a stored USD column.
5. Compare with indexes temporarily dropped (P5: required; throwaway local DB).
6. Optional: first Ask call latency against the 15-second timeout (04 §11 Q4).
Fallback if insights miss the budget: an in-process cache. "Do not build it unless measurement says so."

## 08 §7 Demo script (P1: local after `npm run seed`; P3: Ask required)
1. Land on login. (P1: no cold-start remark; the README covers it.)
2. Log in as HR Admin; `/employees` toolbar shows about 10,000 employees.
3. Filter Country India, Job title Software Engineer, Level L3; URL carries the filters; toolbar shows the cohort count.
4. Open the first employee; record a merit increase of 5% dated today; toast; history top row "Merit increase" `+5.0%`.
5. Insights: a payroll or distribution figure and the FX as-of date.
6. Pay equity: a flagged cohort (gap at or above 5%).
7. Log out; log in as Finance; lands on `/insights`; the nav has no "Employees".
8. Ask "What is the median pay for a Senior Engineer in India?"; show the answer and "How I read your question".
9. Close: live link, three demo accounts, `npm run seed` restores the dataset.
Not in the video: a CSV export deep dive, Playwright.

## Decisions
- D-007: AI prompts and the usage log live in `.ai-notes/`, committed once at the end after review (P9: by the user, by hand).
- D-020: superseded by P6/P8. Both `docs/00-brief-analysis.md` and `docs/assessment-brief.md` are removed.
- CLAUDE.md: no em dashes; Conventional Commits; never `--amend` or force push; no new dependency (talkies stays outside the repo, P2).

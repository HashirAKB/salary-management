
## S0 Walking skeleton (2026-10-10)
- Branch: s0-walking-skeleton. Commit range: 0038996..3d73221 (26 commits).
- Cycles: 7 (A config, B clock, C problem, D error handling, E health, F web canary, G static); one test commit "Already satisfied by 4a76179" (row 15). No refactor commits.
- Tests: 15 rows, all ticked; 23 tests across 7 files. Coverage floor met (domain/ and shared/ at 100%).
- Overrides: 3 decisions from you in planning (Node 24 per D-062 instead of the note's 22; docs amended with A-007 before adding the unnamed packages; msw 2.15.0, react 19.2.8, placeholder fetching /api/health), 1 decision at the BLOCKED stop (render build command option A), 1 self-reported slip (red commit e91da95 committed with a type error, fixed in 9bb7333).
- Vitest 5.0.3 kept; no D-055 fallback.
- Reviewer: PASS, no findings. Its "Not checked" items were verified locally where possible; deploy, CI and branch settings are left for you to check.
- Open: the kit commit subject differs from D-067 wording; the session ran Node 22 by default (nvm default is now 24 for new sessions).

## S1 Schema and seed (2026-10-10)
- Branch: s1-schema-and-seed. Commit range: ad6383b..efaa07c (42 commits). Merged to main in 25fa016 (PR #2).
- Cycles: 16 planned (A migrations, B drift, C toUsdMinor, D SQL form, E random, F reference and bands, G integrity and builders, H allocation, I salaries, J histories, K terminated, L scrypt, M writeDataset, N report, O CLI, P hash) plus 2 from the review (termination window; month-end fix). Refactors: cohort targets into SEED_CONFIG (f4d1735), addDays reuse (971842f). Already-satisfied test commits: d67e212 (FK and transaction guard, proofs shown in session), 9d22f63 (dataset hash).
- Tests: 38 rows, all ticked (rows 24b and 26b added); 77 tests across 21 files. Coverage floor met; domain/ and shared/ at 100%.
- Seed: 10,000 active, 250 terminated, 43k history rows; gaps 8.0 / 6.0 / 5.3 (flagged) / 4.7; 569 outside band; about 11% stale. `npm run seed` 1.9 s locally with production scrypt.
- Overrides: 7 entries in S1/overrides.md (entry 7: CI timeout on the full-seed test, fixed in efaa07c with a 30 s per-test limit for seed.int.test.ts). 3 BLOCKED decisions in planning (A-008 Faker written by me; hashing and toUsdMinor pulled into S1); 2 review decisions; 1 self-reported slip (afa1356 committed on a red tree, repaired by feca494 and 8e675d2).
- Interpretation: stale = 10% of all active employees, chosen among those with 2.5+ years of tenure (02 §7.7's own 10-12% expectation rules out the other reading).
- Reviewer: GAPS FOUND, 2 findings. 1 (termination window 623 instead of 989 days): fixed, fba4a1b and afa1356, then feca494 and 8e675d2. 2 (no foreign_keys pragma): closed without code. The live Turso database reads foreign_keys = 1 and rejected an orphan row in TEMP tables, against Turso's docs; re-check with PRAGMA foreign_key_check after the S2 live seed.
- Open: CI must reproduce dataset hash 042be9bb…; S2 drops the scrypt commits; S2 re-checks foreign keys on Turso after seeding.

## S2 Login and roles
- Date: 2026-10-10. Branch: s2-login-and-roles. Commits: 47b3af3..535e0bf (40 commits; list in .ai-notes/S2/commits.txt).
- Prompt: .ai-notes/S2/prompt.md (/tdd-slice S2 with three notes from S1).
- Cycles: 15 planned-and-added red/green cycles, 3 review-fix cycles, 2 refactors, 1 build (@fastify/rate-limit 11.2.0), 1 test-setup fix.
- Overrides: 5 (.ai-notes/S2/overrides.md): three planning answers (me guard, hand-rolled cookie, S0 test removal), the access-matrix shared-session fix, and the review delegation including trustProxy.
- Reviewer (spec-reviewer): 2 findings, both fixed test-first (login body 400; no retry on ApiError). Background security review: the X-Forwarded-For rate-limit bypass, fixed (trust only the proxy hop); the other flags were intermediate commits already closed by the next cycle.
- Tests: 152 passing; coverage floor green.
- Open: confirm the seed targeted incubytedb; live login check after deploy. Docs updated for trustProxy.

## S3 Employee list with paging (2026-10-10)
Branch: s3-employee-list. Commits: 6daf457..8c40999 (33 commits).
Sessions: P + B1..Bn + R.
Cycles: A-L, plus R (review fix). Overrides: 10 (.ai-notes/S3/overrides.md). Reviewer: GAPS FOUND, 1 finding (loading dim and progress bar missing); fixed test-first (d6a3926, 8c40999).
Tests: 242 passing. Coverage: green/floor (statements 95.61%, branches 89.43%).
Open: manual under-300 ms check at 10,000 rows; push and open the PR.

## S4 Search, filters, sort, CSV export (2026-10-11)
Branch: s4-search-filters-export. Commits: fcc743b..4b25d87 (25 commits).
Sessions: P + B1..Bn + R.
Cycles: A-J. Overrides: 3 (.ai-notes/S4/overrides.md). Reviewer: PASS, no findings.
Tests: 329 passing. Coverage: green/floor (statements 96.18%, branches 89.43%).
Open: push and open the PR.

## S5 View, add, edit, terminate (2026-10-11)
Branch: s5-view-add-edit-terminate. Commits: f26270a..239109a (24 commits).
Sessions: P + B1..Bn + R.
Cycles: A-J. Overrides: 0. Reviewer: PASS, no findings.
Tests: 405 passing under npm test. Coverage: npm run test:coverage has 3 web tests timing out (15 s) under full parallel load, passing alone; floor line not reached.
Open: push and open the PR; watch CI for the coverage-run timeouts (EmployeeListPage, EmployeeFilters, NewEmployeePage tests).

## S6 Salary change history (2026-10-11)
Branch: s6-salary-change-history. Commits: e55a651..4f64256 (27 commits).
Sessions: P + B1..Bn + R.
Cycles: A-M. Overrides: 3. Reviewer: PASS, no findings.
Tests: 510 passing. Coverage: green/floor (statements 93.66%, branches 87.28%).
Open: push and open the PR.

## S7 Insights and pay equity (2026-10-11)
Branch: s7-insights-pay-equity. Commits: 43ea0fe..52abe92 (30 commits).
Sessions: P + B1..Bn + R.
Cycles: A-K, plus D-071 follow-up. Overrides: 2. Reviewer: PASS, no findings.
Tests: 609 passing, 2 failing locally. Coverage: not confirmed locally (EmployeeExport.test.tsx Blob realm failure, untouched by S7); CI verify green on PR #11.
Open: EmployeeExport Blob test fails locally; optional "known limit" line in the D-071 ADR; merge PR #11.

## S8 Ask about pay (2026-10-11)  [DRAFT for review]
Branch: s8-ask-about-pay. Commits: 5f67cdd..866d1a9 (32 commits). Merged as PR #12.
Sessions: P + B1..B3 + R.
Overrides: 1 (.ai-notes/S8/overrides.md): four doc gaps decided at planning (interpretation order, usedToday, gender-rule suggestion, system prompt used verbatim).
Reviewer: review.md is empty; result TODO (user to fill in).
Eval: 13/15 against gemini-flash-latest (bar 13/15), docs/evals/ask-eval-2026-10-11.md.
Tests: count TODO (user to fill in).
Open: TODO.

## S9 Deploy and hardening (2026-10-11)  [DRAFT for review]
Branch: s9-deploy-hardening. Commits: 1e02aff..ea855aa (9 commits listed in commits.txt). Merged as PR #13.
Sessions: P + B1 + R.
Cycles: A-C (waking banner, GET retry in apiFetch, server down state). Cycle D and B2 skipped: cut 3 (Playwright smoke test) applied by the user, logged in ea855aa.
Overrides: 2 (.ai-notes/S9/overrides.md): GET retry lives in apiFetch; cut 3.
Reviewer: review.md is empty; result TODO (user to fill in).
Tests: count TODO (user to fill in).
Open: TODO.

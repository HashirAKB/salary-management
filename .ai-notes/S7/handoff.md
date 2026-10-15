
## Session B1 done (cycles S7 A-D)
Last commit: 00085ad feat(insights): add minimum group suppression
Open rows: none for A-D (E onward still open)
Notes:
- `aggregatePay` has a 5th optional param `labels: Record<key,name>` (not in brief): labels groups and drives name sort for country/department/jobTitle. The repo/service must pass id/code to name maps. Levels sort by code (L1..L5 = rank, CHECK constraint); genders by GENDERS order.
- Engine returns `{key,label,suppressed,headcount,usd,local,outsideBand}`; suppressed groups have all values null. `genderGap` metric deliberately absent (plan Q2, S8). `Metric` only selects which stats appear.
- Empty input returns `[]` for every groupBy including `none` (service must build the empty-state response).
- Percentile expected values in `__fixtures__/pay-rows.ts` were worked out by hand from the PERCENTILE.INC definition, not run in Excel.
- Commit headers max 71 chars (commitlint); lint-staged rejects unused params in stubs (use `_` prefix).
- A comment in pay-query.test.ts ("reverse of code order") is slightly inaccurate; harmless.
- Follow-up after security review: `groupBy: 'none'` now also suppresses under the minimum (tests af089fd, fix below). Last commit is the `fix(insights)` one.

## Session B2 done (cycles S7 E-F)
Last commit: 0de9b21 feat(insights): add summary endpoint
Open rows: none for E-F (G onward still open)
Notes:
- `computePayEquity(rows)` in `domain/pay-equity.ts` returns `{ org:{meanGapPct,medianGapPct,women,men}, cohorts }` with raw ids/codes (`countryCode`, `jobTitleId`, `levelCode`, `meanWomenMinor`, `meanMenMinor`, `currency`), sorted by country/title/level. The service (cycle H) must add names, `Money` wrapping, `basis:'usd'`, `thresholdPct`, `minPerGender`, `cohortCounts`, the gap-desc ordering and `flaggedOnly`/`includeNotComparable`. Org gaps are null when there are no women or no men. Flag is exact (BigInt cross-multiply); gender codes are `female`/`male` only.
- I1 is live: `modules/insights/{repo,service,routes}.ts`, zod contract in `packages/shared/src/schemas/insights.ts` (exported). `repo.loadActivePayRows(db)` has no filters yet; G/H add them (the planned `refactor` loads once per request). `loadCountryNames` gives the labels map.
- Each new route needs a row in `apps/api/src/http/access-matrix.test.ts` (D-054); add G's and H's routes there in the red commit.
- Tests with a clock other than 2026-10-09 must pass `createdAt` to `loggedInAs`, or the session is expired (401).
- Edge, no test: if Finance's total active headcount is under 5, I1 returns headcount 0, payroll 0 and no outside-band numbers (the `none` group is suppressed). Not specified in the docs.
- Finance can derive a suppressed country from the total minus the others; the brief and D-012 allow it as written.

## Security follow-up after B2 (D-071)
Commits: a33c1fb test, 4d08d6b feat, docs commit after it.
- `aggregatePay` now also suppresses the smallest visible group (ties by key) when exactly one group is suppressed and minGroupSize > 1. Applies to I1 byCountry, I2 all groupBys, and Ask later. Not applied to `none`, I3 cohort counts, or differencing across requests with different filters (listed as not covered in D-071).
- Existing fixtures changed: pay-query.test.ts minimum-size fixture is now US 6, DE 5, IN 3; insights routes test expects Finance to see DE hidden as well as IN.
- OPEN for cycle J (S-8): a row hidden by D-071 can have 5+ people, but the UI text is "Fewer than 5". RESOLVED: row text is "Hidden to protect small groups"; Ask message "Some figures are hidden to protect groups of fewer than 5 employees." (docs updated).
- Cycle I matrix should assert the D-071 property, not only "no group under 5".

## Session B3 done (cycles S7 G-I)
Last commit: f2ca7fc test(insights): never send finance a group under five
Open rows: none for G-I (J, K open)
Notes:
- Commits: 140a7b7 test / 1743fbb feat (I2), b3378cb test / cf2eddb feat (I3), f2ca7fc test (matrix, already satisfied by 4d08d6b, cf2eddb, 1743fbb; proved by breaking the D-071 line and the Finance minimum).
- Shared contract in `packages/shared/src/schemas/insights.ts`: `payDistributionQuerySchema/ResponseSchema`, `payEquityQuerySchema/ResponseSchema` (+ types, `PAY_DISTRIBUTION_GROUPS`). `commaList` is now exported from `schemas/employee.ts`; booleans use `z.stringbool()`.
- I2 and I3 validate list values via `checkListValues` (now exported from employees/service.ts): unknown country/department etc. gives 400 like E1. I2 level labels are "L3 Senior" (code + name), genders use GENDERS names.
- Judgement call, not in brief: in I3 the `org` block uses ALL active women and men (04 says "every active woman and man"); the country/department filters narrow only `cohorts` and `cohortCounts`. A test asserts this.
- `KEY_OF` is now exported from `domain/pay-query.ts` (service uses it to find a group's currency for `local`).
- The planned `refactor(insights): load the active projection once per request` was skipped: each of I1, I2, I3 already loads rows once.
- Matrix I3 case only checks comparable/not-comparable shape; D-071 differencing is not applied to cohorts (listed as not covered in D-071).
- Shell note: `cat` is aliased to a missing `batcat` here; use `command cat` or the Read/Write tools (a plain `cat > file <<EOF` silently wrote an empty file).
- Security review (cross-request differencing via I2 filters) acknowledged and accepted as specified; see overrides.md. Mention in the /tdd-finish spec review as a known, documented limit.

## Session B4 done (cycles S7 J-K)
Last commit: 5bdd732 feat(web): add pay equity page
Open rows: none (all S7 rows ticked)
Notes:
- Commits: 9f8f10a build charts, b728ab8 test / eea98bc feat (J), 3ebe27f test / feat (K).
- Extra tests beyond the list: J filters-in-URL, K filters-in-URL, K empty state. Charts untested (Cut 4); chart axis uses formatMoney from format.ts.
- Non-flagged comparable cohorts show an empty Status cell (docs silent).
- Not run: coverage, lint on final commit beyond the chain, e2e. Ready for /tdd-finish S7.

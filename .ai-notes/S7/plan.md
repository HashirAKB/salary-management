# S7 plan (approved 2026-10-11)

Branch: `s7-insights-pay-equity`. Spec: `.ai-notes/S7/brief.md`. Tests: `.ai-notes/S7/test-list.md`.

## Decisions from planning
- Q1 (06 S7 acceptance, Ask `no measurable gap (0.0%)`): S7 proves `0.0%` on screen only; the Ask wording becomes an S8 test row.
- Q2 (04 §6 `genderGap` engine metric): not built in S7; added with a test in S8 (only Ask uses it).
- brief.md is ~9 KB (over the 4 KB target) to keep the full response shapes and verbatim 05 rows.

## Sessions and cycles
B1 (domain)
- A percentiles (3 U): `apps/api/src/domain/percentiles{,.test}.ts`, `domain/__fixtures__/pay-rows.ts`
  red `test(insights): compute percentiles like excel percentile.inc` / green `feat(insights): add percentile function`
- B gapPct, sharePct (3 U): `packages/shared/src/percent{,.test}.ts`
  red `test(shared): compute gender gap and share percentages` / green `feat(shared): add gap and share percentages`
- C engine totals (3 U): `apps/api/src/domain/pay-query{,.test}.ts`
  red `test(insights): aggregate headcount, totals and averages in usd per group` / green `feat(insights): add pay aggregation engine`
- D grouping, suppression (2 U): same files
  red `test(insights): suppress groups under the minimum size` / green `feat(insights): add minimum group suppression`

B2
- E pay equity domain (4 U): `apps/api/src/domain/pay-equity{,.test}.ts`
  red `test(insights): compute cohort gender gaps and flag at five percent` / green `feat(insights): add pay equity computation`
- F I1 summary (4 I): `packages/shared/src/schemas/insights.ts` (zod contract goes in the red commit as stub), `apps/api/src/modules/insights/{repo,service,routes,routes.test}.ts`, `app.ts`
  red `test(insights): return the summary for the hand-built fixture` / green `feat(insights): add summary endpoint`

B3
- G I2 (1 I it.each): red `test(insights): return pay distribution by each dimension` / green `feat(insights): add pay distribution endpoint`
- H I3 (2 I): red `test(insights): return pay equity cohorts with filters` / green `feat(insights): add pay equity endpoint`
- I Finance matrix (1 I): `test(insights): never send finance a group under five`; `fix(insights)` only if red
- `refactor(insights): load the active projection once per request`

B4
- `build(web): add mantine charts` (`@mantine/charts` 9.7.1 to match core, recharts pinned exact; ADR 0007; Cut 4)
- J insights page (4 C): `apps/web/src/features/insights/{InsightsPage,useInsightsFilters,api}`, `AppRoutes.tsx`
  red `test(web): show insights with suppressed rows and role-based links` / green `feat(web): add insights page`
- K pay equity page (2 C): `PayEquityPage`, `usePayEquityFilters`
  red `test(web): show pay equity with not-comparable rows and review badges` / green `feat(web): add pay equity page`

R: `/tdd-finish S7` (lint, typecheck, coverage, spec review).

## Acceptance → proof
- Percentiles match PERCENTILE.INC: cycle A, Excel fixture row.
- Finance never receives a group under 5: cycle I matrix (I1, I2 all groupBys, I3) + F 3-person country row.
- Gap `0.0%`: cycle K row 2. Suppressed share `n/a`: cycle J share row.
- Ask `no measurable gap (0.0%)`: deferred to S8 (Q1).
- Terminated leave insights (S5 check): cycle F row 2.
- Charts: Cut 4, no test.

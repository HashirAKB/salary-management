# S7 test list

## Already covered by earlier slices (no new test)
[x] U  toUsdMinor rounds half up to the cent  (05 §5.6 U row 3; packages/shared/src/money.test.ts)
[x] I  TS and SQL USD conversions agree  (05 §5.6 I row 1; apps/api/src/db/money-sql.test.ts, S3)

## Cycle A: percentiles  (apps/api/src/domain/percentiles.test.ts)
[x] U  matches Excel PERCENTILE.INC for [1,2,3,4] at 0.25, 0.5 and 0.75  (05 §5.6 U row 1)
[x] U  a single value is its own P25, median and P75 and the input is not mutated  (05 §5.6 U row 2)
[x] U  matches the Excel results stored with the pay-rows fixture  (06 S7 acceptance 1; __fixtures__/pay-rows.ts)

## Cycle B: shared gapPct and sharePct  (packages/shared/src/percent.test.ts)
[x] U  gapPct is (men - women) / men * 100, positive when women are paid less  (05 §5.6 U row 9)
[x] U  gapPct and compaRatio round half away from zero from integers, never -0  (05 §5.6 U row 10)
[x] U  sharePct is part * 1000 / total in tenths  (04 §8.4.1)

## Cycle C: engine totals  (apps/api/src/domain/pay-query.test.ts)
[x] U  total and average are computed from per-employee USD values  (05 §5.6 U row 4)
[x] U  local figures appear only when a group has one currency  (05 §5.6 U row 5)
[x] U  outside-band counts split below and above, band limits count as inside  (05 §5.6 U row 6)

## Cycle D: engine grouping and suppression  (pay-query.test.ts)
[x] U  groups under the minimum size are suppressed with no values; the HR minimum suppresses nothing  (05 §5.6 U row 7)
[x] U  groupBy none returns one all group; empty groups omitted; levels by rank, others by name  (05 §5.6 U row 8)

## Cycle E: pay equity domain  (apps/api/src/domain/pay-equity.test.ts)
[x] U  a cohort is flagged at exactly 5.00% and not at 4.99% unrounded  (05 §5.6 U row 11)
[x] U  a cohort with 4 women or 4 men is not comparable and carries no numbers  (05 §5.6 U row 12)
[x] U  non-binary and not-disclosed count in headcount but not in either mean  (05 §5.6 U row 13)
[x] U  org mean and median gaps are computed in USD  (05 §5.6 U row 14)

## Cycle F: I1 summary  (apps/api/src/modules/insights/routes.test.ts)
[x] I  the summary matches the hand-computed fixture  (05 §5.6 I row 2)
[x] I  the summary excludes terminated employees  (05 §5.6 I row 3; S5 acceptance)
[x] I  staleSalaries.since is today minus two years  (05 §5.6 I row 4)
[x] I  Finance sees a 3-person country as suppressed; HR Admin sees its numbers  (05 §5.6 I row 5)

## Cycle G: I2 distribution
[x] I  pay distribution groups by each dimension and applies filters (it.each)  (05 §5.6 I row 6)

## Cycle H: I3 pay equity
[x] I  returns the flagged cohort first, hides not-comparable unless asked, honours flaggedOnly  (05 §5.6 I row 7)
[x] I  Finance and HR get the same pay-equity body  (05 §5.6 I row 8, D-047)

## Cycle I: Finance matrix
[x] I  Finance never receives a group under 5 from any insights endpoint (it.each over I1, I2 groupBys, I3)  (06 S7 acceptance 1)

## Cycle J: insights page  (apps/web/src/features/insights/InsightsPage.test.tsx)
[x] C  a suppressed row shows "Hidden to protect small groups"  (05 §5.6 C row 1)
[x] C  HR roles see the outside-band and stale cards as links; Finance sees plain counts  (05 §5.6 C row 2)
[x] C  payroll by country shows share 0.0% and n/a for a suppressed country  (06 S7 acceptance 2)
[x] C  changing "Group by" updates the URL and the table  (05 §5.6 C row 4)
[x] C  distribution request carries the URL filters and groupBy  (added in J; justifies useInsightsFilters)

## Cycle K: pay equity page  (apps/web/src/features/insights/PayEquityPage.test.tsx)
[x] C  shows "Too few to compare" rows and a "Review" badge with text on flagged rows  (05 §5.6 C row 3)
[x] C  shows a gap that rounds to zero as 0.0%  (06 S7 acceptance 2)

## Added after the security review (D-071), done in a33c1fb / 4d08d6b
[x] U  one suppressed group also hides the smallest visible group; two suppressed, one group, or HR minimum add nothing  (pay-query.test.ts)
[x] I  cycle I matrix must also cover D-071: for Finance, I1 and every I2 groupBy never let total minus visible groups recover a single suppressed group

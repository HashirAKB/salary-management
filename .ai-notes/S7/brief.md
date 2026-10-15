# S7 brief: Insights and pay equity (branch s7-insights-pay-equity)

## Endpoints (04 §5.0, §5.6). All need `insights.read` (HR Admin, HR Viewer, Finance: yes). 200 only; 401 / 400 (unknown param, D-039) via the existing pipeline. Active employees only (D-016).
**I1 `GET /api/insights/summary`**, no params → `{ fxAsOf, headcount, payrollUsd: Money, byCountry: [{ country:{code,name}, headcount, suppressed, payrollLocal: Money, payrollUsd: Money }], outsideBand:{below,above,total}, staleSalaries:{since,count} }`. `since` = today minus 2 years (`date(today,'-2 years')`, TS from the clock). Load projection once, engine twice (none, country), metrics `headcount,total,outsideBandCount`. `byCountry` by country name. Suppressed (Finance, <5): `headcount`, `payrollLocal`, `payrollUsd` = `null`.
**I2 `GET /api/insights/pay-distribution`** (`PayDistributionQuery`): `groupBy` = `none|country|department|jobTitle|level|gender` (default `country`); lists `country, department, jobTitle, level, gender` as E1. → `{ fxAsOf, groupBy, filters:{countries,departmentIds,jobTitleIds,levelCodes,genders}, groups:[{ key, label, headcount, suppressed, usd:{min,p25,median,p75,max,average,total}, local:{same 7 keys}|null }] }`. `local` only when the group has one currency. Empty groups omitted. Order: country/department/jobTitle by name, levels by rank, genders in reference order; `none` → one group `key:"all"`, `label:"All active employees"`. Suppressed: `headcount`, `usd`, `local` = `null`.
**I3 `GET /api/insights/pay-equity`** (`PayEquityQuery`): `country` list, `department` list, `flaggedOnly` (false), `includeNotComparable` (false). → `{ fxAsOf, thresholdPct:5, minPerGender:5, org:{meanGapPct,medianGapPct,women,men,basis:"usd"}, cohortCounts:{withEmployees,comparable,flagged}, cohorts:[{ country:{code,name}, jobTitle:{id,name}, level:{code,name}, comparable, women, men, meanWomen:Money, meanMen:Money, gapPct, flagged }] }`. Cohort = country+title+level (D-013), means in local currency. <5 women or <5 men → `comparable:false`, `women,men,meanWomen,meanMen,gapPct` = `null`, `flagged:false`, every role (D-047). Org uses all active women and men in USD. `cohortCounts` reflects filters, before `flaggedOnly`. Order: comparable by `gapPct` desc, then not-comparable by country, title, level; not-comparable only with `includeNotComparable=true`. Not paged.

## Engine (04 §6, D-040)
`domain/pay-query.ts` pure: `aggregatePay(rows: PayRow[], metrics: Metric[], groupBy: Dimension|'none', minGroupSize)`. `PayRow { countryCode, departmentId, jobTitleId, levelCode, gender, salaryMinor, currency, usdPerUnitMicros, bandMinMinor, bandMaxMinor, salaryEffectiveDate }`. Metric = `headcount|total|average|median|p25|p75|min|max|outsideBandCount|genderGap`. Repo: filters in SQL (`status='active'` + lists), one query joining `job_titles`, `pay_bands`, `fx_rates`. Per group: USD per row via `toUsdMinor`; total/average (half up to cent) and percentiles over USD; same in local if one currency; outside band split below/above; `headcount < minGroupSize` → `suppressed:true`, no values. `domain/pay-equity.ts` computes I3 from the same `PayRow[]`. `aggregateMinGroupSize(role)`: finance 5, HR 1 (exists).

## Money (02 §4)
Convert each employee to USD, then aggregate; local-currency figures aggregated without conversion. Percentiles D-024: sorted `x`, `h=(n-1)p`, `x[floor(h)] + (h-floor(h))*(x[floor(h)+1]-x[floor(h)])`, rounded to cent (Excel PERCENTILE.INC). Outside band: `<min` below, `>max` above, equal is inside. Gap `(meanMale-meanFemale)/meanMale*100`, flag when unrounded ≥5, positive = women paid less; org mean and median gaps in USD.

## Percent and display (04 §8.4.1). `shared/percent.ts`, integer, half away from zero, never `-0`
`gapPct(menMinor, womenMinor)`: tenths=(men-women)*1000/men. `sharePct(part,total)`: tenths=part*1000/total. Gap shows `8.0%`, `-1.2%`, `0.0%`, null `Too few to compare`. Share shows `40.0%`, `0.0%`, null `n/a` (suppressed country); computed in web from `payrollUsd`. `formatGapPct`/`formatSharePct` exist in web `format.ts`.

## Screens (04 §8.5)
**S-8 `/insights`**: cards Active headcount; Annual payroll (USD); Paid outside band (`560`, `281 below, 279 above`); No salary change since `9 Oct 2024`. HR roles: last two link to `/employees?band=outside` and `/employees?salaryUnchangedSince=2024-10-09`; Finance plain counts. Payroll by country table (Country, Headcount, Payroll local, Payroll USD, share) + bar chart. Distribution: segmented "Group by" (Country, Department, Job title, Level, Gender), filters Country, Department, Job title, Level in URL (`useInsightsFilters`); table Group, Headcount, Min, P25, Median, P75, Max, Average (USD; local underneath if one currency); median bar chart. Suppressed: "Hidden to protect small groups" across row. FX note. Empty: "No active employees match these filters." Error per section with "Retry".
**S-9 `/insights/pay-equity`**: cards "Mean gap (unadjusted)", "Median gap (unadjusted)" + "Compares all women with all men, across different roles and levels. Use the cohort table for like-for-like comparisons." Line "171 of 250 cohorts can be compared; 3 are flagged." Filters Country, Department, "Flagged only", "Show cohorts too small to compare" (`usePayEquityFilters`). Table Country, Job title, Level, Women, Men, Mean (women), Mean (men), Gap, Status; flagged → "Review" badge with icon. Not comparable → "Too few to compare" across number columns. Footnote "Flagged at a gap of 5% or more, the EU Pay Transparency Directive's joint pay assessment trigger. Cohorts need at least 5 women and 5 men. A flag is a signal to review, not a legal finding." Empty "No cohorts match these filters."
Query keys `['insights','summary']`, `['insights','distribution',q]`, `['insights','pay-equity',q]` (04 §8.3). Charts: `@mantine/charts` (ADR 0007), Cut 4.

## ADRs
D-012 Finance never sees a group under 5. D-013 cohort = country+title+level, flag ≥5%, numbers only with 5 women and 5 men. D-016 terminated excluded. D-024 PERCENTILE.INC in TS. D-040 one engine, min group size applied inside it. D-047 same pay-equity body for all roles.

## 05 §5.6 rows (verbatim)
Unit fixture: a hand-built list of `PayRow`s with numbers checked in Excel (`PERCENTILE.INC`), stored in `domain/__fixtures__/pay-rows.ts` with the Excel results next to it.

| Level | Test |
| --- | --- |
| U | percentiles match Excel's `PERCENTILE.INC` for `[1,2,3,4]` at 0.25, 0.5 and 0.75 (1.75, 2.5, 3.25) |
| U | a single value is its own P25, median and P75; the input array is not mutated |
| U | USD conversion rounds half up to the cent (`toUsdMinor`) |
| U | total and average are computed from per-employee USD values |
| U | local figures appear only when a group has one currency |
| U | outside-band counts split below and above, and the band limits count as inside |
| U | groups under the minimum size are suppressed with no values; the HR minimum suppresses nothing |
| U | `groupBy: none` returns one `all` group; empty groups are omitted; levels sort by rank, others by name |
| U | gender gap is `(men - women) / men * 100`, positive when women are paid less |
| U | `compaRatio` and `gapPct` round half away from zero from integers (`compaRatio(100500, 100000)` is `1.01`, not floating-point `1.00`; a gap under 0.05% either way is `0`, never `-0`) |
| U | a cohort is flagged at exactly 5.00% and not at 4.99% (unrounded) |
| U | a cohort with 4 women or 4 men is not comparable and carries no numbers |
| U | non-binary and not-disclosed employees count in headcount but not in either mean |
| U | org mean and median gaps are computed in USD |
| I | the TypeScript and SQL USD conversions agree for a table of amounts (02 section 4) |
| I | the summary matches the hand-computed fixture: headcount, payroll by country, outside band, stale count |
| I | the summary excludes terminated employees |
| I | `staleSalaries.since` is today minus two years |
| I | Finance sees a 3-person country as suppressed; HR Admin sees its numbers |
| I | pay distribution groups by each dimension (`it.each`) and applies filters |
| I | pay equity returns the flagged cohort first, hides not-comparable cohorts unless asked, and honours `flaggedOnly` |
| I | Finance and HR get the same pay-equity body (D-047) |
| C | a suppressed row shows "Hidden to protect small groups" |
| C | HR roles see the outside-band and stale cards as links; Finance sees plain counts |
| C | pay equity shows "Too few to compare" rows and a "Review" badge with text on flagged rows |
| C | changing "Group by" updates the URL and the table |

## 06 S7 acceptance (verbatim)
- Distribution percentiles for the Excel fixture match `PERCENTILE.INC`; Finance never receives a group under 5 in any insights response (checked by the matrix-style test over all three endpoints).
- Gap % and share of payroll display per 04 section 8.4.1, including a gap that rounds to zero (`0.0%`, and `no measurable gap (0.0%)` in Ask) and a suppressed country's share (`n/a`).

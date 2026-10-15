# S6 brief: Salary change and history (branch s6-salary-change-history)

Verbatim from docs; section in brackets. Silent here = `BLOCKED:`.

## Goal and acceptance [06 S6]
HR Admin records a raise, promotion or correction, and anyone in HR can see exactly how someone's pay got where it is.
- After any change, the employee's current-salary columns equal their latest history row (the invariant test from S1 still passes on a database touched by the app).
- For the same amounts, the history's Change column and the salary form's preview show the same value, both from shared `changePct`. The hire row shows `n/a`, and a change under 0.05% in either direction shows `0.0%`.
- Cut 4: the live preview under the salary form.

## Roles [04 §4.5]
| `salary.read` | HR Admin yes | HR Viewer yes | Finance no | S1 |
| `salary.write` | HR Admin yes | HR Viewer no | Finance no | S2 |

## S1 `GET /api/employees/:id/salary-changes` [04 §5.5]
Newest first. Previous values are computed in TypeScript from the next-older row (D-025). Not paged. Item fields: `id`, `effectiveDate`, `reason`, `amount`, `previousAmount` (null on hire), `changePct` (null on hire), `jobTitle {id,name}`, `level {code,name}`, `previousJobTitle`, `previousLevel` (null on hire), `changedBy`, `createdAt`. Body `{ "items": [...] }`.
`changedBy` is `{ "displayName": "HR Admin (demo)" }` or `null` (seeded, shown as "Imported"). Rows with the same effective date are ordered by `id`. Errors: 404.
`changePct` is `changePct(previousAmountMinor, amountMinor)` from `packages/shared/src/percent.ts` ... The salary-change form's preview (S-6) calls the same function.

## S2 `POST /api/employees/:id/salary-changes` (`SalaryChangeBody`) [04 §5.5]
`{ "effectiveDate": "2026-10-09", "reason": "merit", "amount": { "amountMinor": 206000000, "currency": "INR" }, "jobTitleId": 1, "levelCode": "L3" }`. The position is always sent, even when unchanged.
Validation (400): all fields required; `reason` one of the 4 UI reasons (`hire` is rejected); `amountMinor` integer from 1 to 10^12.
Rules (422), checked in this order, all in `domain/salary-rules.ts` returning the first violation:
1. `EMPLOYEE_TERMINATED` 2. `DATE_IN_FUTURE` (after today) 3. `SALARY_DATE_BEFORE_CURRENT` (before current `salary_effective_date`; equal is allowed) 4. `SALARY_CURRENCY_MISMATCH` 5. Per reason (D-022):

| Reason | Amount | Title | Level | Code if broken |
| `merit`, `market_adjustment` | > current | = current | = current | `RAISE_REQUIRED`, `POSITION_MUST_NOT_CHANGE` |
| `promotion` | > current | any | rank > current rank | `RAISE_REQUIRED`, `PROMOTION_LEVEL_NOT_HIGHER` |
| `correction` | any > 0 | any | any | `CORRECTION_NO_CHANGE` if amount, title and level all equal current |

6. `NO_PAY_BAND` if the new position has no band in the employee's country.
Effects, in one write transaction: insert the history row (`changed_by_user_id` = viewer, `created_at` from the clock), update `salary_minor`, `salary_effective_date`, `job_title_id`, `level_code`, `updated_at` on the employee (D-021, D-029).
201 with `Location` of the employee and body `{ "employee": EmployeeDetail, "change": SalaryChangeItem }`.
Shared `salary.ts` exports [04 §4.7]: `SalaryChangeReason` (the 4 UI reasons), `SalaryChangeBody`, `SalaryChangeItem`, `SalaryHistoryResponse`.

## Money and percent [02 §4, 04 §8.4.1]
Money is `{ amountMinor, currency }` integer minor units. `changePct(prevMinor, nextMinor)`: tenths = (next - prev) * 1000 / prev, integer arithmetic, rounded half away from zero on the integer remainder, never `-0`; no `Math.round`. Display: `formatPct(value, { signed })`; Salary change %: 1 decimal, `+4.2%`, `-1.0%`, `0.0%` no sign, `n/a` for null (hire row). Money in forms: major units, 2 decimals, to minor by string parsing.

## UI [04 §8.5 S-3, S-6, §8.6]
S-3 history table: Effective date, Reason, Amount, Change (`+4.2%`), Position (`L2 Intermediate to L3 Senior` when it changed, otherwise the position), Recorded by (`Imported` when null). Actions (HR Admin only): "Record salary change" (active employees only).
S-6 modal: Reason (Promotion, Merit increase, Market adjustment, Correction). Effective date (default and max `today` from `me`, min the current salary's effective date). New annual salary (currency fixed). Job title and Level. Merit and Market adjustment lock title and level to current. Promotion offers only higher levels, title editable. Correction leaves everything editable. Live preview: current to new amount, change %, new compa-ratio and band position for the chosen position (R2). Success: modal closes, toast "Salary change recorded.", history and salary card refresh.
8.6: `SALARY_CURRENCY_MISMATCH`, `RAISE_REQUIRED` → Amount field. `SALARY_DATE_BEFORE_CURRENT`, `DATE_IN_FUTURE` → Date field. `POSITION_MUST_NOT_CHANGE`, `PROMOTION_LEVEL_NOT_HIGHER` → Level field. `CORRECTION_NO_CHANGE`, `NO_PAY_BAND` ("There's no pay band for this country, job title and level.") → form alert. `EMPLOYEE_TERMINATED` → close modal, refresh, toast with `detail`. `VALIDATION_FAILED` → `errors[]` under fields.

## Decisions
D-021 history is append-only; `employees` carries current salary, written in the same transaction. D-022 date on/after current, ≤ today, country currency; per-reason rules above. D-029 title and level change only through a salary change. D-019 system writes `hire` first row; history records who and when. D-025 no LAG/LEAD: previous values in TS.

## 05 §5.5 rows (verbatim)
| U | salary rules return the first violation in the order of 04 section 5.5 (`it.each` over the reason table) |
| U | accepts an effective date equal to the current salary's date |
| U | rejects a date after today and a date before the current salary's date |
| U | merit and market adjustment need a higher amount and the same title and level |
| U | promotion needs a higher amount and a higher level rank, and allows a new title |
| U | correction allows a lower amount, and rejects a change that changes nothing |
| U | `changePct` rounds half away from zero in integer arithmetic: `100000` to `100050` is `0.1`, to `100040` is `0`, to `99960` is `0` (never `-0`), to `99950` is `-0.1`; the hire row's `changePct` is null |
| I | a merit raise returns 201, appends one history row and updates the current-salary columns |
| I | a promotion updates the employee's level, and the history shows the level before and after |
| I | each rule violation returns 422 with its code (`it.each`, one per code) |
| I | a salary change on a terminated employee returns 422 `EMPLOYEE_TERMINATED` |
| I | if the second write fails, neither the history row nor the employee update is kept (injected failing repository, named in the test) |
| I | history lists newest first with previous amount, change % and position before and after |
| I | seeded rows show `changedBy: null`; rows recorded in the app show the recorder's display name |
| I | two changes on the same date are ordered by id |
| C | merit locks title and level; promotion offers only higher levels |
| C | the date field's default and maximum are `me.today` |
| C | shows `RAISE_REQUIRED` under the amount field and `PROMOTION_LEVEL_NOT_HIGHER` under level |
| C | history shows "Imported" for seeded rows, "L2 Intermediate to L3 Senior" for a promotion, and `n/a` in the hire row's Change column |
| C | after success, the modal closes and the history refreshes |

# S3 brief: Employee list with paging (only spec source for build sessions)

## Routes (04 §5.0, §4.5)
| ID | Route | Action | HR Admin | HR Viewer | Finance | Success |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | `GET /api/reference` | `reference.read` | yes | yes | yes | 200 |
| E1 | `GET /api/employees` | `employee.read` | yes | yes | no (403) | 200 |

Pipeline (04 §4.3): auth hook, `requires(action)` (401 `UNAUTHENTICATED`, 403 `FORBIDDEN`), zod validation of query via the route `schema` option: 400 `VALIDATION_FAILED`, then one service call. Errors are problem+json (04 §4.4). Each route gets its `EXPECTED_ACCESS` row in its red commit.

## R1 (04 §5.3)
"Everything the filters, forms and Ask labels need, in one call."
```json
{ "countries": [{ "code": "CA", "name": "Canada", "currency": "CAD" }],
  "departments": [{ "id": 1, "name": "Engineering" }],
  "jobTitles": [{ "id": 1, "name": "Software Engineer", "departmentId": 1 }],
  "levels": [{ "code": "L1", "name": "Associate", "rank": 1 }],
  "genders": [{ "code": "female", "name": "Female" }, { "code": "male", "name": "Male" }, { "code": "non_binary", "name": "Non-binary" }, { "code": "not_disclosed", "name": "Not disclosed" }],
  "salaryChangeReasons": [{ "code": "promotion", "name": "Promotion" }, { "code": "merit", "name": "Merit increase" }, { "code": "market_adjustment", "name": "Market adjustment" }, { "code": "correction", "name": "Correction" }],
  "fx": { "asOfDate": "2026-09-30", "rates": [{ "currency": "INR", "usdPerUnit": "0.011500" }] } }
```
"Lists are sorted by name (levels by rank). `usdPerUnit` is a display string built from the micros; no client arithmetic uses it." Tests read IDs from reference data, never hard-code them.

## E1 (04 §5.4), S3 subset
| Param | Type | Default | Rule |
| --- | --- | --- | --- |
| `page` | integer >= 1 | 1 | "A page past the end returns `items: []` with the real `total`" |
| `pageSize` | 25, 50, 100 | 50 | |
| `status` | `active`, `terminated`, `all` | `active` | |

"Name order is `last_name, first_name, id`." "Errors: 400 `VALIDATION_FAILED` (including unknown params)." Other params (`q`, filters, `sort`) arrive in S4; until then they are unknown and get 400.
```json
{ "items": [{ "id": 4217, "employeeCode": "E004217", "firstName": "Priya", "lastName": "Nair", "gender": "female",
    "country": { "code": "IN", "name": "India" }, "department": { "id": 1, "name": "Engineering" },
    "jobTitle": { "id": 1, "name": "Software Engineer" }, "level": { "code": "L3", "name": "Senior" },
    "status": "active", "hireDate": "2021-07-12", "terminationDate": null,
    "salary": { "amountMinor": 198000000, "currency": "INR" }, "salaryUsd": { "amountMinor": 2277000, "currency": "USD" },
    "salaryEffectiveDate": "2026-04-01", "compaRatio": 0.97, "bandPosition": "inside" }],
  "page": 1, "pageSize": 50, "total": 280, "totalPages": 6, "fxAsOf": "2026-09-30" }
```
`bandPosition`: `below` | `inside` | `above`. Shared schema names (04 §4.7): `reference.ts` → `ReferenceResponse`; `employee.ts` → `EmployeeListQuery`, `EmployeeListItem`, `EmployeeListResponse`.

## Money (02 §4)
- "Conversion: `usdMinor = Math.round(amountMinor * usdPerUnitMicros / 1_000_000)` ... In SQL: `(e.salary_minor * f.usd_per_unit_micros + 500000) / 1000000`." Reuse `toUsdMinor` (shared `money.ts`) and `usdMinorSql` (`apps/api/src/db/money-sql.ts`); the agreement test exists already.
- "Compa-ratio: `salary_minor / mid_minor` of the employee's band, same currency, shown to 2 decimals."
- "Outside band: `salary_minor < min_minor` (below) or `salary_minor > max_minor` (above). Equal to min or max is inside."
- Index I2 `(status, last_name, first_name, id)` serves the default list.

## percent.ts (04 §8.4.1), S3 adds only `compaRatio`
"integer arithmetic on minor units, rounded half away from zero, never returning `-0`." "`compaRatio(salaryMinor, midMinor)`: hundredths = salary * 100 / mid." "`Math.round` is not used." Example (05 §5.6): `compaRatio(100500, 100000)` is `1.01`, not floating-point `1.00`.

## Formatting (04 §8.4, `web/src/format.ts`)
- Money: "`Intl.NumberFormat` with `style: 'currency'`, `currencyDisplay: 'code'`, no fraction digits; locale `en-IN` for INR (lakh grouping), `en-US` otherwise. `INR 20,48,000`, `USD 23,552`". Formatting happens only in the web `Money` component.
- Forms: "Major units with 2 decimals, converted to minor units on submit by string parsing (never floating-point multiply)".
- Dates: "`Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })`: `9 Oct 2026`".
- Level `L3 Senior`. FX note: "`FX as of 30 Sep 2026` under every view with converted figures" (`FxAsOf`).
- "`formatPct(value, { signed })` uses `Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'negative' })` plus `%`."

| Value | Decimals | Positive | Negative | Rounds to zero / zero | Null |
| --- | --- | --- | --- | --- | --- |
| Salary change % | 1 | `+4.2%` | `-1.0%` | `0.0%`, no sign | `n/a` |
| Gender gap % | 1 | `8.0%` | `-1.2%` | `0.0%` | `Too few to compare` |
| Share of total USD | 1 | `40.0%` | n/a | `0.0%` | `n/a` |
| Compa-ratio | 2 | `0.97` | n/a | n/a | n/a |

## Web S-2 `/employees`, S3 parts (04 §8.5, §8.3)
- Toolbar: "Showing 51 to 100 of 2,431 employees"; "Add employee" (HR Admin only), linking to `/employees/new`.
- Columns: "Employee ID, Name, Country, Job title, Level, Salary (local, with USD underneath in smaller text), Band (badge: Below, Inside, Above with text, not color alone; compa-ratio in a tooltip), Hire date, Status badge for terminated rows."
- "Footer: Mantine `Pagination`, page size select (25, 50, 100), FX note."
- "Loading: first load shows 10 skeleton rows; later loads keep the previous rows dimmed with a thin progress bar." Use `placeholderData: keepPreviousData`. Query key `['employees', query]`, staleTime 30 s.
- "Empty, no filters: 'No employees yet.' with 'Add employee' for HR Admin."
- "Page out of range: 'This page is past the end of the results.' with 'Go to last page'."
- "Error: inline alert with `detail` and 'Retry'."
- URL state (planning decision): `page` and `pageSize` live in search params via `useEmployeeFilters`, defaults left out of the URL. A page-size change goes to page 1.
- Not in S3: filter bar, sort headers, Export CSV (S4), row click to detail (S5).

## Theme (06 S3 scope, verbatim)
"Mantine theme (`createTheme` with violet primary, `md` radius and striped table defaults) and `ColorSchemeScript` wired into `main.tsx`; dark mode toggle `ActionIcon` in the app shell user menu (`Shell.tsx`), colour scheme persisted in `localStorage` via `localStorageColorSchemeManager`. All from the already-installed `@mantine/core@9.7.1`." No icon library is installed: use inline SVG, and give the toggle an `aria-label`.

## Carry-over from S2 (prompt notes)
Helpers: `aUser(role)`, `loggedInAs(db, role)`, `aSessionFor(db, userId)`, `anEmployee()` builder, `testDb()`, `testApp({ db })`; web `aMeResponse(role)`, `aProblem()`, `render()` returns `queryClient`, msw `server`. Never `.parse` in a handler. Screens use `useViewer()`, call `apiFetch`, and test query behaviour through `useQuery`. Use `withAsterisk={false}` or a regex label. Full-seed tests stay in `seed.int.test.ts`.

## Owned 05 rows (verbatim)
- §5.3 U: "the list query schema applies defaults, splits and de-duplicates comma lists, and rejects unknown params" (S3: defaults and unknown params only; comma lists in S4)
- §5.3 U: "`pageSize` accepts only 25, 50 and 100"
- §5.3 I: "returns active employees sorted by last name, 50 per page, with `total` and `totalPages`"
- §5.3 I: "a page past the end returns no items and the real total"
- §5.3 I: "returns each item with salary in local currency and USD, compa-ratio and band position"
- §5.3 C: "renders the rows and the 'Showing 1 to 50 of N' line"
- §5.3 C: "shows the error alert with 'Retry' on a 500 problem"
- §5.3 C: "shows 'Add employee' to HR Admin only, and 'Export CSV' to both HR roles" (S3: Add employee half only; Export CSV moved to S4)
- §5.6 U (compa half, borrowed from S7): "`compaRatio` ... round half away from zero from integers (`compaRatio(100500, 100000)` is `1.01`, not floating-point `1.00`)"
- §5.6 I (done in S1): "the TypeScript and SQL USD conversions agree for a table of amounts"
- §5.9 U: "money formats INR with lakh grouping and other currencies in `en-US` (`INR 20,48,000`, `USD 23,552`)"
- §5.9 U: "dates format as `9 Oct 2026` in UTC whatever the machine's zone"
- §5.9 U: "major-unit input converts to minor units by string parsing (`"0.29"` to 29, `"20480.50"` to 2048050), rejecting a third decimal"
- §5.9 U: "change % displays per 04 section 8.4.1 (`it.each`): `4.2` to `+4.2%` (positive); `-1.0` to `-1.0%` (negative); `0` and `-0` to `0.0%` (exact zero); `0.04` to `0.0%` (positive rounding to zero); `-0.04` to `0.0%` (negative rounding to zero); `null` to `n/a`; `0.05` to `+0.1%` and `-0.05` to `-0.1%` (ties away from zero)"
- §5.9 U: "gap %, share % and compa-ratio display per 04 section 8.4.1 (`it.each`): gap `8.0` to `8.0%`, `-1.2` to `-1.2%`, `0.04` and `-0.04` to `0.0%`, `null` to `Too few to compare`; share `null` to `n/a`; compa `0.97` to `0.97`"
- 06 S3: "Dark mode toggle: C, `Shell` renders a toggle that switches and persists the colour scheme"

## Acceptance (06 S3)
- "The default page answers in under 300 ms locally at 10,000 rows (rough check; Chat 8 measures properly)." Checked by hand in the finish session.
- "Percentages and compa-ratio follow 04 section 8.4.1 for every case in the 05 section 5.9 table: a value that rounds to zero shows `0.0%` (never `+0.0%` or `-0.0%`), null shows `n/a`, and ties round away from zero."

# S3 Employee list with paging: plan

## Context
Slice S3 (06 §5): HR roles page through active employees sorted by name, with salary in local currency and USD, plus R1 reference data, web formatting helpers, the list page, and a Mantine theme with a dark mode toggle. This session only plans. Plan mode blocks writes, so the setup steps from `/tdd-plan` §0 (prompt.md, branch) run right after approval, followed by writing the `.ai-notes/S3/*` files below.

## Decisions taken in planning (go to `.ai-notes/S3/overrides.md`)
1. **05 §5.3 U row 1.** S3 tests defaults and the 400 for unknown params (the schema is strict from S3). S4 adds comma-list splitting and de-duplication. Until S4, `?country=` etc. return 400.
2. **05 §5.3 C row 7.** S3 tests only "Add employee for HR Admin only". The "Export CSV for both HR roles" half moves to S4. You asked for this to be logged in docs: commit 6daf457 `docs(docs): split s3 list rows between s3 and s4` edits 06 S3 and S4 test lists (Export CSV half and the U row 1 comma-list split).
3. **Page state.** `page` and `pageSize` live in the URL (`?page=2&pageSize=100`, defaults left out), in `useEmployeeFilters`, which S4 extends with filters. A page-size change goes back to page 1.
4. **Extra tests (no 05 row).** R1 integration; E1 400 wiring; compaRatio unit (borrowed from 05 §5.6 U row 10, compa half only); pager and page size; skeleton; "No employees yet."; past-the-end notice.

## Post-approval steps (this session)
1. Write `.ai-notes/S3/prompt.md` (the invocation, verbatim).
2. `git switch -c s3-employee-list` (tree is clean, on `main`).
3. Write `.ai-notes/S3/brief.md`, `test-list.md`, `plan.md` (this cycle plan) and `overrides.md` (the decisions above).
4. Edit `docs/06-build-plan.md` S3 and S4 test lists for decision 2; committed as 6daf457.
5. End the session.

## brief.md (content, verbatim excerpts, about 4 KB)
- **Routes (04 §5.0, §4.5):** R1 `GET /api/reference`, `reference.read` (all three roles), 200. E1 `GET /api/employees`, `employee.read` (HR Admin, HR Viewer; Finance 403), 200. Pipeline 04 §4.3: auth, guard `requires(action)`, zod validation via route `schema` (400 `VALIDATION_FAILED`), handler. `Cache-Control: no-store` already global.
- **R1 body (04 §5.3):** countries{code,name,currency}, departments{id,name}, jobTitles{id,name,departmentId}, levels{code,name,rank}, genders{code,name}, salaryChangeReasons{code,name} (4 UI reasons, no `hire`), fx{asOfDate, rates[{currency, usdPerUnit:"0.011500"}]}. Lists sorted by name, levels by rank. `usdPerUnit` is a display string from micros.
- **E1 query (04 §5.4, S3 subset):** `page` int >= 1, default 1, past the end gives `items: []` with the real `total`; `pageSize` 25|50|100, default 50; `status` active|terminated|all, default active. Unknown params 400. Name order `last_name, first_name, id`.
- **E1 body:** the item JSON from 04 §5.4 (id, employeeCode, firstName, lastName, gender, country{code,name}, department{id,name}, jobTitle{id,name}, level{code,name}, status, hireDate, terminationDate, salary Money, salaryUsd Money, salaryEffectiveDate, compaRatio, bandPosition) plus page, pageSize, total, totalPages, fxAsOf.
- **Money (02 §4):** conversion and SQL form lines; outside-band rule (equal to min/max is inside); compa-ratio = salary/mid. Reuse `toUsdMinor` (`packages/shared/src/money.ts`) and `usdMinorSql` (`apps/api/src/db/money-sql.ts`); the 05 §5.6 agreement test already exists (`money-sql.test.ts`).
- **Formatting (04 §8.4, §8.4.1):** money table row, dates row, money-in-forms row, FX note, Level `L3 Senior`; compaRatio calc rule; `formatPct` Intl options; the display table.
- **S-2 (04 §8.5), S3 parts:** columns, toolbar count line, "Add employee" (HR Admin), footer Pagination + page size + FX note, loading (10 skeleton rows, then dimmed rows with `keepPreviousData`), "No employees yet.", past-the-end text, error alert with `detail` and "Retry". Out of S3: filter bar, sort, Export CSV, row click to detail.
- **06 S3 theme line** verbatim (violet, `md` radius, striped tables, `ColorSchemeScript`, `localStorageColorSchemeManager`). No icon library is installed, so the toggle uses inline SVG.
- **05 rows** owned (verbatim), and the S2 carry-over notes 1 to 7 from the prompt.
- **ADR rulings:** none beyond the above (Docs line names none).

## test-list.md
```
[ ] U  applies defaults page 1, pageSize 50, status active and rejects unknown params  (05 §5.3 U row 1, defaults + unknown; comma lists in S4)
[ ] U  pageSize accepts only 25, 50 and 100  (05 §5.3 U row 2)
[ ] U  compaRatio rounds half away from zero from integers (100500/100000 is 1.01)  (05 §5.6 U row 10, compa half; extra)
[ ] I  returns reference data sorted by name, levels by rank, with fx as of date  (04 R1; extra)
[ ] I  returns active employees sorted by last name, 50 per page, with total and totalPages  (05 §5.3 I row 1)
[ ] I  a page past the end returns no items and the real total  (05 §5.3 I row 2)
[ ] I  rejects pageSize 30 and an unknown param with 400 VALIDATION_FAILED  (04 E1; extra, proves schema option wiring)
[ ] I  returns each item with salary in local currency and USD, compa-ratio and band position  (05 §5.3 I row 12; below, at min, at max, above)
[x] I  the TypeScript and SQL USD conversions agree  (05 §5.6 I row 1; done in S1, money-sql.test.ts)
[ ] C  Shell toggles dark and light mode and persists it in localStorage  (06 S3 test list)
[ ] U  money formats INR with lakh grouping and others in en-US  (05 §5.9 U row 1)
[ ] U  dates format as 9 Oct 2026 in UTC  (05 §5.9 U row 2)
[ ] U  major-unit input converts to minor units by string parsing  (05 §5.9 U row 3)
[ ] U  change % displays per 8.4.1 (it.each)  (05 §5.9 U row 4)
[ ] U  gap %, share % and compa-ratio display per 8.4.1 (it.each)  (05 §5.9 U row 5)
[ ] C  renders the rows and the "Showing 1 to 50 of N" line  (05 §5.3 C row 1)
[ ] C  shows 10 skeleton rows on first load  (04 S-2; extra)
[ ] C  changing the page or page size updates the URL and requests that page  (06 demo; extra)
[ ] C  shows "This page is past the end of the results." with "Go to last page"  (04 S-2; extra)
[ ] C  shows the error alert with "Retry" on a 500 problem  (05 §5.3 C row 6)
[ ] C  shows "No employees yet." with "Add employee" for HR Admin  (04 S-2; extra)
[ ] C  shows "Add employee" to HR Admin only  (05 §5.3 C row 7, Add half; Export half in S4)
```

## Cycles
Red commits add `throw new Error('not implemented')` stubs. A new route's red commit registers it with `onRequest: requires(...)` and a handler that throws, and adds its `EXPECTED_ACCESS` row, so the run fails on assertions and not on imports.

| Cycle | Tests | Files | Red | Green |
| --- | --- | --- | --- | --- |
| A | U row 1, U row 2 | `packages/shared/src/schemas/employee.ts` (+`.test.ts`), `index.ts` | `test(shared): apply list query defaults and reject unknown params` | `feat(shared): add employee list query schema` |
| B | compaRatio | `packages/shared/src/percent.ts` (+test), `index.ts` | `test(shared): round compa-ratio half away from zero from integers` | `feat(shared): add compa-ratio calculation` |
| C | R1 | `apps/api/src/modules/reference/routes.ts` (+test), `app.ts`, `access-matrix.test.ts`, `packages/shared/src/schemas/reference.ts` | `test(api): return reference data for filters and forms` | `feat(api): add reference endpoint` |
| D | I row 1, I row 2, 400 wiring | `apps/api/src/modules/employees/{routes,service}.ts` (+`routes.test.ts`), `app.ts`, `access-matrix.test.ts`, shared `employee.ts` response schemas | `test(employees): page active employees by name with totals` | `feat(employees): add employee list endpoint with offset paging` |
| E | I row 12 | `employees/service.ts` (join `pay_bands`, `fx_rates`; `usdMinorSql`; `compaRatio`) | `test(employees): return local and usd salary with band position` | `feat(employees): add usd salary and band position to the list` |
| F | (no behaviour) | `apps/web/src/theme.ts`, `main.tsx` (`ColorSchemeScript`, theme, manager), `test/render.tsx` (same theme and manager) | — | `chore(web): add mantine theme with violet primary and table defaults` |
| G | dark mode | `components/Shell.tsx` (+`Shell.test.tsx`) | `test(web): toggle dark and light mode from the user menu` | `feat(web): add dark mode toggle to the shell user menu` |
| H | 05 §5.9 U rows 1–3 | `apps/web/src/format.ts` (+test) | `test(web): format money, dates and major-unit input` | `feat(web): add money, date and input formatting helpers` |
| I | 05 §5.9 U rows 4–5 | `format.ts` | `test(web): format percentages and compa-ratio per 8.4.1` | `feat(web): add percentage formatting helpers` |
| J | C row 1, skeleton | `features/employees/EmployeeListPage.tsx` (+test), `components/Money.tsx`, `components/FxAsOf.tsx`, `routes.ts`/`AppRoutes.tsx` (replace placeholder through ROUTES), `test/fixtures/employees.ts` | `test(web): render the employee table with count and pager` | `feat(web): add employee list page` |
| K | pager/page size, past-the-end | `features/employees/useEmployeeFilters.ts`, `EmployeeListPage.tsx` | `test(web): change page and page size through the url` | `feat(web): keep list page and page size in the url` |
| L | C row 6, "No employees yet.", C row 7 (Add half) | `EmployeeListPage.tsx` | `test(web): show list error, empty state and add button by role` | `feat(web): add list error, empty and add-employee states` |

Refactor commits only when one is worth making (`refactor(scope): …`).

## Sessions
- **B1:** A, B, C (shared schema, compaRatio, R1)
- **B2:** D, E (E1 endpoint)
- **B3:** F, G, H, I (theme, dark mode, format.ts)
- **B4:** J, K, L (list page)
- **R:** `/tdd-finish S3`: lint, typecheck, `test:coverage`, build, spec review, plus the manual 300 ms check

## Acceptance → proof
| Criterion | Proof |
| --- | --- |
| Demo: "Showing 1 to 50 of 10,000", local + USD, page and size work | C row 1, cycle K tests, I row 12; R session runs `npm run seed` + `npm run dev` and looks |
| Default page under 300 ms at 10k rows | **No automated proof (flagged).** R session times `GET /api/employees` against the seeded DB (rough, as 06 says), records it in the handoff |
| Percentages and compa-ratio per 8.4.1 for every 05 §5.9 case (0.0%, n/a, ties away from zero) | Cycle I (05 §5.9 U rows 4–5) + cycle B |
| Every new route in the access matrix with problem details | `EXPECTED_ACCESS` rows in cycles C, D; matrix tests |
| Theme: violet, `md` radius, striped tables | **No test (flagged; config only).** Visual check in R |

## Verification
Each green: `npm test`, `npm run typecheck`. R session: `npm run lint && npm run typecheck && npm run test:coverage && npm run build`, spec-reviewer agent, seeded manual check of `/employees` as HR Viewer.

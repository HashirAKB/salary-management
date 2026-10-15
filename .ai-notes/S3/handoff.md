
## Session B1 done (cycles S3 A-C)
Last commit: b52fa2d feat(api): add reference endpoint
Open rows: cycles D onward (rows 7-24 of test-list.md)
Notes: `cat` is aliased to a missing `batcat` in this shell, so use /bin/cat or the Read tool; heredocs into files silently write empty files. R1 returns every fx_rates row (including USD), sorted by currency; brief and 04 5.3 only show INR as an abridged example. `referenceRoutes(app, { db })` is wired in app.ts. `employeeListQuerySchema` is a strictObject with coerced page and pageSize.

## Session B2 done (cycles S3 D-E)
Last commit: 519ddaf feat(employees): add usd salary and band position to the list
Open rows: cycles G-L (13 rows unchecked in test-list.md); cycle F (theme, no test) not started
Notes: Commits 8611f86 test D, 0409efa feat D, c5578c4 test E, 519ddaf feat E. The 400-wiring test passed on the red stub (route registered with its schema); proved it fails by removing the schema option, noted in the red commit body. In red E the shared item schema was left alone (typecheck would break) and the test reads raw JSON; the green added salaryUsd, compaRatio and bandPosition to `employeeListItemSchema` in shared `employee.ts` (also exports `moneySchema`, `bandPositionSchema`, `employeeListResponseSchema`). Service uses inner joins on pay_bands and fx_rates (every employee has a band, 02 section 3) and `usdMinorSql`. Still true: `cat` is broken here and heredocs write empty files; use Write or python for files. Pre-commit lint-staged runs prettier on staged files. No refactor commits this session.

## Session B3 done (cycles S3 F-I)
Last commit: ef738ed feat(web): add percentage formatting helpers
Open rows: J, K, L rows (list page) remain
Notes: F committed with a masked typecheck failure, fixed in 126e1c1. Toggle is an ActionIcon beside the user menu (aria-label "Switch to dark/light mode"), key acme-color-scheme in theme.ts. format.ts exports formatMoney, formatDate, parseMajorToMinor (null on invalid, e.g. third decimal), formatPct, formatChangePct, formatGapPct, formatSharePct, formatCompaRatio. Use set -o pipefail in command chains; plain cat is aliased to batcat here (use Read/Edit).

## Session B4 done (cycles S3 J-L)
Last commit: 3fb0e50 feat(web): add list error, empty and add-employee states
Open rows: none
Notes:
- IMPORTANT, spec vs ICU: 04 §8.4 lists the en-GB `month: 'short'` options but shows `30 Sep 2026`; Node's ICU prints `Sept`. `formatDate` now normalises to `Sep` (test 4490f40, fix d7e185c). `docs/` untouched; the spec reviewer may flag the mismatch, it is deliberate. Use `formatDate` for every date, never a bare formatter.
- Test setup changes: `vitest.config.ts` web `testTimeout` 15 s (50-row table took ~5 s under load); `test/render.tsx` uses `MantineProvider env="test"` (Select options queryable); page size select is `role="combobox"` (test fixed in 6f807a3, approved).
- `useEmployeeFilters` (page, pageSize in URL, defaults omitted) does no validation of URL values; bad values show the API's 400 in the alert. S4 extends the hook with filters, sort and `q`, and should add validation.
- Page: Add employee button hidden in the empty state's toolbar (the empty state has its own); past-the-end shows only when `total > 0`.
- Not covered by tests (finish session to eyeball): dimmed rows plus thin progress bar on later loads (`keepPreviousData` is wired, no visual indicator yet), Money/FxAsOf have no unit tests, only page-level ones. The loading-dim/progress bar is a gap against 04 §8.5 "Loading": add in finish or S4 if the spec reviewer flags it.
- Only `/employees` has a real screen; `SCREENS` map in `AppRoutes.tsx` holds built screens, the rest stay placeholders.

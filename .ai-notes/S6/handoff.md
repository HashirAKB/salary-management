
## Session B1 done (cycles S6 A-D)
Last commit: 11318d8 feat(salary): add promotion rules
Open rows: E-M (correction, rule order, API, web)
Notes: `checkSalaryChange(context)` in apps/api/src/domain/salary-rules.ts takes {today, employee, change, hasPayBand} with levelRank values and returns a code or null; date, merit/market and promotion rules done. Terminated, currency, correction, pay band rules are still to add (E, F). Added `Money` type export in shared employee.ts. `cat` is aliased to batcat in the shell, so heredocs via cat fail; use python or Write. The full suite is flaky under parallel load (a web test failed once, passed on rerun).

## Session B2 done (cycles S6 E-H)
Last commit: e3a3469 test(salary): return 422 for each rule violation
Open rows: I-M (atomicity, S1 history, web)
Notes: G's green went beyond its tests: the service already maps every rule code to a 422 with a message, so H's tests passed on first run (proved by breaking the mapping; commit body says so). The write seam for cycle I is `SalaryWrites` in modules/salary/service.ts (insertChange, updateEmployee, run inside db.transaction); inject it via `buildApp({ salaryWrites })` / `testApp({ salaryWrites })`. `SalaryChangeItem` and `SalaryHistoryResponse` schemas now exist in shared salary.ts; the service builds the S2 item inline, so J should extract a shared history projection (previous values in TS, D-025). apps/api/test/invariants.ts has currentSalaryMismatches(db). The S1 row is not yet in EXPECTED_ACCESS (cycle J). commitlint header max is 71 chars. `cat` is aliased to batcat; use /bin/cat.

## Session B3 done (cycles S6 I-K)
Last commit: see `git log -1` (feat(web): add salary history table)
Open rows: L-M (web modal, outcomes, preview)
Notes: I was test-only, proved by removing the transaction (commit 7a36eca, body "Already satisfied by 4da72d1"). J: `listSalaryHistory` in modules/salary/service.ts builds items ascending by (effectiveDate, id) then reverses, so on one date the higher id comes first (04 says only "ordered by id"; I read it as newest first). recordSalaryChange still builds its item inline; could share a projection. K: `SalaryHistoryTable` takes items; the page fetches `['employee', id, 'salary-changes']` (key to invalidate in M), only with `salary.read`, and shows the card "Salary history". Unchanged position shows "Software Engineer, L3 Senior"; a title move shows "Title, L2 X to Title, L3 Y" (04 gives only the level-move example; untested). web/test/server.ts now has a default empty-history handler so existing detail tests don't hit an unhandled request. Fixed Card aria id for titles with spaces. Fixtures: web/test/fixtures/salary.ts. `cat` is aliased; use /bin/cat.

## Session B4 done (cycles S6 L-M)
Last commit: see `git log -1` (feat(web): refresh history and show outcome toasts)
Open rows: none
Notes: Cycle L's green commit (not the planned split) also swallowed the test-file fixes because staged files from a hook-rejected commit stayed staged: commit 3985a9b "test(web): fix selectors..." contains the modal and page code too. No amend allowed, so left as is. Decisions not in the brief: reason defaults to Promotion (first listed); job title options are all titles; empty amount/level are caught client-side; the preview shows change %, new compa-ratio and "Inside/Below/Above band" from R2 (hidden if no band). Replaced the S5 assertion that HR Admin has no salary-change button (EmployeeDetailPage.test.tsx). The modal does not parse the 201 body (no shared response schema, zod not a web dependency); it invalidates ['employee', id] and the history instead. Mantine selects: query by role combobox, not label. Full suite is flaky under load; rerun a failed file alone.
Worker cap: vitest.config.ts maxWorkers 6 (commit 4f64256) fixes web timeouts under load; don't run suites in parallel with the Stop hook.

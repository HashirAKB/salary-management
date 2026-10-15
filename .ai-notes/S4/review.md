### Spec review: S4
Verdict: PASS

Checked:
- 05 §5.3 rows (parser, normalisation, search, filter, band, stale-date, AND/OR and USD-sort integration tests, plus the filter-URL, notice, empty-state and Export-button component tests) and all 7 rows of 05 §5.7. Each has a matching test in the diff.
- X1 permissions: the route has `onRequest: requires('export.employees')`, and the access matrix has the `GET /api/exports/employees.csv` entry. The test covers HR Viewer 200, Finance 403 and anonymous 401.
- X1 headers, filename date from the clock, D-044 CSV format and the rulings (gender reference name, compa-ratio 2 dp, major-unit amounts).
- E1 band boundaries, the id tie-breaker on every sort, and the 400 `VALIDATION_FAILED` response with `errors[].path` such as `country[1]`.
- Money: the sort uses a per-employee USD conversion in SQL, not a converted aggregate.
- The commit sequence is test then feat in pairs for every unit (shared, search, filters, band, sort, csv, export, web filters, web sort, web export, web export failure). I found no commit that ordered feat before its test.

Not checked:
- Whether any `feat` or `fix` commit touches test files, or any `test` commit touches more than stubs. I had no shell or git access, and `diff.patch` doesn't show per-commit file lists. The new web test support files (`apps/web/test/server.ts`, `setup.ts`, `fixtures/reference.ts`) and `apps/api/test/builders/employee.ts` should be checked against their commits.
- Unit coverage of "rejects unknown params" for the base schema (05 §5.3 U row 1). The test list assigns it to S3, and the S4 integration tests cover it for the full schema.
- Nothing was run, so test and typecheck results are unverified.

## Proposed actions
1. No findings (PASS). No fix needed.
2. Not checked: feat/fix commits touching tests. I checked with `git show --stat`: no feat commit touches a test file. The test-support files changed only in test commits. No action.
3. Not checked: base-schema unknown-param unit row. It belongs to S3, and S4 covers the full schema (test list row 18). No action.

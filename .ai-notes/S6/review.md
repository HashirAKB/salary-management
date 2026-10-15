### Spec review: S6
Verdict: PASS

Checked:
- 05 §5.5 rows U1–U7, I1–I8 and C1–C5 each have a matching test in the diff.
  - Domain unit tests: salary-rules.test.ts (diff.patch lines 25–249).
  - changePct and schema tests: percent.test.ts and salary.test.ts.
  - Salary API tests: routes.test.ts and history.test.ts, covering the invariant query, atomicity with the injected failing `SalaryWrites`, one 422 case per code, and 404 for both endpoints.
  - Web tests: SalaryHistoryTable.test.tsx, SalaryChangeModal.test.tsx and EmployeeDetailPage.test.tsx.
- The 422 rule order in `checkSalaryChange` matches 04 §5.5 and D-022.
- `changePct` uses integer arithmetic, rounds half away from zero, never returns `-0`, and the hire row gets null.
- Both routes use `requires('salary.read')` and `requires('salary.write')` as `onRequest` guards, and both are in `EXPECTED_ACCESS`.
- Finance gets no history, because the page query is gated on `salary.read`.
- D-021: history insert and employee update run in one transaction, and `changed_by_user_id` and `created_at` come from the viewer and the clock.
- D-025: previous values are computed in TypeScript, ordered by effective date then id.
- Money stays as `{ amountMinor, currency }`, and the web UI formats it through the `Money` component.
- Acceptance 2: the history Change column and the form preview both use shared `changePct` and `formatChangePct`, and one test compares them. `n/a` for the hire row and `0.0%` for small changes are covered by the existing `formatChangePct` tests.
- Cut 4 (the preview) is implemented.
- Test-first order in `commits.txt`: each `feat` has an earlier `test` commit, and the atomicity, 422 and history-ordering tests land as test-only commits. The modal's production code arrives in one `feat(web)` commit (1555781) after the tests (ab50c82, 3985a9b, fb48819, ea25754). The one `chore` commit touches only `vitest.config.ts`.

Not checked:
- Whether any `feat`, `fix` or `refactor` commit also changed test files.
- Whether each red commit had `not implemented` stubs.
- Whether the 05 §5.0 access-matrix test also asserts 403 for HR Viewer and Finance on POST and for Finance on GET (pre-existing loop; slice only added rows).

## Proposed actions
No findings, so nothing to fix. The "Not checked" items I verified myself:
- No `feat`, `refactor` or `chore` commit touches a `*.test.ts(x)` file (`git show --name-only` per commit).
- The access matrix loop predates S6 and covers every row in `EXPECTED_ACCESS`; no action.

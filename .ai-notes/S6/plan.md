# S6 approved plan (branch s6-salary-change-history)

Rulings: Q1 (a) build the live preview (Cut 4 not taken): current to new amount, change % via shared changePct, compa-ratio and band position from R2; one "+" C row in cycle M. Brief is 7.4 KB (over target; accepted with the plan).
Tests: test-list.md (26 rows; "+" rows come from the 04 contract or 06 acceptance).

## Cycles (red test(scope) then green feat(scope))
A shared: changePct (U7), SalaryChangeBody 400 | test(shared): compute change percent and validate salary change body | feat(shared): add change percent and salary schemas
B salary: date rules (U2, U3) | test(salary): accept a date equal to the current salary date, reject future and earlier dates | feat(salary): add date rules
C salary: merit, market adjustment (U4) | test(salary): require a raise and same position for merit and market adjustment | feat(salary): add merit and market adjustment rules
D salary: promotion (U5) | test(salary): require a raise and a higher level for promotion | feat(salary): add promotion rules
E salary: correction (U6) | test(salary): allow lower pay on correction but reject no change | feat(salary): add correction rules
F salary: rule order it.each (U1) | test(salary): check the rules in order and return the first violation | feat(salary): add terminated, currency and pay band rules ; then refactor(salary): table-drive the per-reason rules
G salary: S2 merit 201 + promotion (I1, I2); adds apps/api/test/invariants.ts (current-salary vs latest-history query, same as S1 seed test) asserted here; adds S2 row to EXPECTED_ACCESS; salary service gets a write seam for cycle I | test(salary): record a change and update the current salary in one transaction | feat(salary): add salary change endpoint
H salary: 422 per code, terminated, S2 404 (I3, I4, +) | test(salary): return 422 for each rule violation | feat(salary): map rule violations to problems
I salary: rollback (I5), test-only commit per 06; prove it can fail by temporarily removing the transaction, then restore | test(salary): keep neither write when the second one fails
J salary: S1 history (I6-I8, + 404); adds S1 row to EXPECTED_ACCESS | test(salary): list history newest first with previous values | feat(salary): add salary history endpoint
K web: history table (C4) | test(web): show history with imported rows and position changes | feat(web): add salary history table
L web: button visibility (+), lock by reason (C1), date default/max (C2), field errors (C3) | test(web): lock fields by reason and map rule errors to fields | feat(web): add record salary change modal
M web: success refresh (C5), EMPLOYEE_TERMINATED (+), preview matches history (+) | test(web): close and refresh after a salary change | feat(web): refresh history and show outcome toasts

## Files
shared: packages/shared/src/percent.ts, packages/shared/src/schemas/salary.ts, packages/shared/src/index.ts (+ tests)
api: apps/api/src/domain/salary-rules.ts (+ test), apps/api/src/modules/salary/{routes,service}.ts (+ routes.test.ts), apps/api/src/app.ts, apps/api/src/http/access-matrix.test.ts, apps/api/test/invariants.ts
web: apps/web/src/features/employees/{EmployeeDetailPage,SalaryHistoryTable,SalaryChangeModal}.tsx (+ tests), apps/web/test/fixtures/{employees,salary}.ts

## Sessions
B1: A-D. B2: E-H. B3: I-K. B4: L-M. R: lint, coverage, spec-reviewer, handoff.

## Acceptance proof
1 current = latest history after app writes: G (I1, I2) and I assert the invariant query.
2 same change % in history and preview: A (rounding, 0.0%, never -0), K (n/a hire row), M (preview equals history row).

# S5 approved plan (branch s5-view-add-edit-terminate)

Rulings: Q1 (a) list half only; the insights half of 05 I row 8 is deferred to S7. Q2 (a) no "Record salary change" button until S6. Brief is 6.8 KB (over target; accepted with the plan).
Tests: test-list.md (30 rows; "+" rows come from the 04 contract).

## Cycles (red test(scope) then green feat(scope))
A employees: E2 detail, 404/400 | test(employees): show one employee with band and compa-ratio | feat(employees): add employee detail endpoint
B api: R2 pay band, 404 | test(api): return the pay band for a position | feat(api): add pay band endpoint
C shared: PersonName, CreateEmployeeBody, UpdateEmployeeBody, TerminateBody | test(shared): reject empty, long and formula-leading names | feat(shared): add person name schema
D employees: create 201, Location, code, hire row, current salary | test(employees): create an employee with code, hire row and current salary | feat(employees): add create employee
E employees: 422 rules and their order | test(employees): reject future hire date, wrong currency and missing band | feat(employees): add create rules
F employees: PATCH name_search, strict keys, terminated allowed | test(employees): edit name and gender only | feat(employees): add employee edit
G employees: terminate, leaves default list, 422 codes | test(employees): terminate once, not before hire or in the future | feat(employees): add termination
H web: detail page, role actions, 404, terminated banner | test(web): show employee detail with role-based actions | feat(web): add employee detail page
I web: add page, band preview warning, errors[] mapping, 8.6, success toast | test(web): add an employee with band warning and field errors | feat(web): add new employee page
J web: edit and terminate modals | test(web): edit details and terminate from the detail page | feat(web): add edit and terminate modals
K refactor(employees): share employee detail mapping between endpoints

Every API red commit adds its route row to EXPECTED_ACCESS in apps/api/src/http/access-matrix.test.ts (D-054).

## Files
shared: packages/shared/src/schemas/{common,employee,reference}.ts (+ tests)
api: apps/api/src/modules/employees/{routes,service}.ts, apps/api/src/modules/reference/routes.ts (+ tests), apps/api/src/http/access-matrix.test.ts
web: apps/web/src/features/employees/{EmployeeDetailPage,NewEmployeePage,EditEmployeeModal,TerminateModal}.tsx (+ tests), AppRoutes.tsx SCREENS, apps/web/test/fixtures/employees.ts (detail fixture)

## Sessions
B1: A-C. B2: D-G. B3: H-I. B4: J-K. R: lint, coverage, spec-reviewer, handoff.

## Acceptance proof
PATCH jobTitleId 400 naming key: F (it.each). Leaves default list: G row 1. Insights headcount: deferred to S7 (Q1). Demo band bar and compa-ratio: H. Outside-band warning: I. Fix a name: F, J. Terminate: G, J.

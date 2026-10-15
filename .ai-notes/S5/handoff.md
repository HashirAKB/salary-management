## Session B1 done (cycles S5 A-C)
Last commit: 4d9c83e feat(shared): add person name schema
Open rows: none for A-C
Notes: A added getEmployee in employees/service.ts (duplicates selectItems mapping; K shares it) and employeeDetailSchema/employeeIdParamsSchema in shared. B added payBandParamsSchema/payBandResponseSchema. C: personNameSchema (generic message "Name can't start with ..."; no per-field label, web maps by path), createEmployeeBodySchema, updateEmployeeBodySchema (strict, partial, non-empty), terminateBodySchema (shared employee.ts). Access matrix has rows for E2 and R2; D-G add theirs in each red commit.

Follow-up after B1: security review found personNameSchema let "  =cmd" through (raw check ran before trim). Fixed in the last two commits.

## Session B2 done (cycles S5 D-G)
Last commit: 98b54ae feat(employees): add termination
Open rows: none for D-G (G row 1 asserts the default list only; insights half deferred to S7 per Q1)
Notes: service.ts has createEmployee (checkCreateRules: future date, currency, band; unknown country/title ends as NO_PAY_BAND, brief silent so this is the natural fall-through), updateEmployee, terminateEmployee (checks 404, already terminated, future, before hire). All three end with getEmployee; K can share the detail mapping with selectItems. Routes and EXPECTED_ACCESS rows added for E3-E5. Extra tests beyond the list: hire date today, outside-band starting salary, termination on today/hire date. Web tests EmployeeExport/EmployeeFilters/EmployeeListPage occasionally time out in a full parallel run and pass on rerun. In this zsh, bare `cat` is aliased to a missing batcat; use `command cat` or Read.

## Session B3 done (cycles S5 H-I)
Last commit: see `git log -1` (feat(web): add new employee page); H red c0e9176, green 1a807dc; I red 77f12a8
Open rows: none for H-I
Notes: No toast library is allowed (no dependency named in docs), so components/Toasts.tsx adds ToastProvider (in Shell) and useToast(message). A toast can ride a navigation: navigate(path, { state: { toast } }); the provider shows it once and clears the state. J can use useToast() for "Details updated." The list's Add button passes state { from: search } so Cancel on /employees/new returns with filters. EmployeeDetailPage action buttons ("Edit details", "Terminate") are inert; J wires the modals. Detail query key is ['employee', id]; invalidate ['employees'] after writes. Gender labels are a static map in EmployeeDetailPage (J can use useReference). Extra tests beyond list: below-band text, 500 retry, inside-band no warning, required fields on client, SALARY_CURRENCY_MISMATCH, Cancel keeps filters. EmployeeFilters/List tests flake occasionally under a full parallel run. Bare `cat` is aliased to missing batcat: use `command cat`.

## Session B4 done (cycles S5 J-K)
Last commit: 239109a refactor(employees): share employee detail mapping between endpoints
Open rows: none
Notes: J red 04ec362, green 3759c49 (EditEmployeeModal, TerminateModal, wired in EmployeeDetailPage for HR Admin; tests in EmployeeModals.test.tsx). Modal forms live in an inner component so state resets on each open. Writes setQueryData on ['employee', id] and invalidate ['employees']. K: selectEmployeeRows/toListItem in employees/service.ts now shared by selectItems and getEmployee. No overrides.md needed (no corrections). Edit modal gender Select has allowDeselect=false.

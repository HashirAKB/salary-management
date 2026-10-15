# S6 test list ("+" = no 05 row; derived from the 04 contract or 06 acceptance)

## A shared: changePct and salary schemas
[x] U  changePct rounds half away from zero in integer arithmetic: 100000 to 100050 is 0.1, to 100040 is 0, to 99960 is 0 (never -0), to 99950 is -0.1  (05 §5.5 U row 7)
[x] U  SalaryChangeBody rejects reason hire, unknown keys and an amount outside 1 to 10^12  (+ 04 §5.5 S2 validation)

## B salary: date rules
[x] U  accepts an effective date equal to the current salary's date  (05 §5.5 U row 2)
[x] U  rejects a date after today and a date before the current salary's date  (05 §5.5 U row 3)

## C salary: merit and market adjustment
[x] U  merit and market adjustment need a higher amount and the same title and level  (05 §5.5 U row 4)

## D salary: promotion
[x] U  promotion needs a higher amount and a higher level rank, and allows a new title  (05 §5.5 U row 5)

## E salary: correction
[x] U  correction allows a lower amount, and rejects a change that changes nothing  (05 §5.5 U row 6)

## F salary: rule order (then refactor: table-drive per-reason rules)
[x] U  salary rules return the first violation in the order of 04 section 5.5 (it.each over the reason table)  (05 §5.5 U row 1)

## G salary: S2 record a change
[x] I  a merit raise returns 201, appends one history row and updates the current-salary columns  (05 §5.5 I row 1; also asserts the S1 invariant query, 06 acceptance 1)
[x] I  a promotion updates the employee's level, and the history shows the level before and after  (05 §5.5 I row 2)

## H salary: S2 rule violations
[x] I  each rule violation returns 422 with its code (it.each, one per code)  (05 §5.5 I row 3)
[x] I  a salary change on a terminated employee returns 422 EMPLOYEE_TERMINATED  (05 §5.5 I row 4)
[x] I  returns 404 EMPLOYEE_NOT_FOUND when recording a change for an unknown employee  (+ 04 §5.5 "Errors: 404", §8.6)

## I salary: atomicity (test-only commit, per 06)
[x] I  if the second write fails, neither the history row nor the employee update is kept (injected failing repository, named in the test)  (05 §5.5 I row 5)

## J salary: S1 history
[x] I  history lists newest first with previous amount, change % and position before and after  (05 §5.5 I row 6)
[x] I  seeded rows show changedBy: null; rows recorded in the app show the recorder's display name  (05 §5.5 I row 7)
[x] I  two changes on the same date are ordered by id  (05 §5.5 I row 8)
[x] I  history returns 404 EMPLOYEE_NOT_FOUND for an unknown employee  (+ 04 §5.5 S1 "Errors: 404")

## K web: history table
[x] C  history shows "Imported" for seeded rows, "L2 Intermediate to L3 Senior" for a promotion, and n/a in the hire row's Change column  (05 §5.5 C row 4)

## L web: salary change modal fields and errors
[x] C  shows "Record salary change" to HR Admin on an active employee only  (+ 04 §8.5 S-3 actions; S5 Q2)
[x] C  merit locks title and level; promotion offers only higher levels  (05 §5.5 C row 1)
[x] C  the date field's default and maximum are me.today  (05 §5.5 C row 2)
[x] C  shows RAISE_REQUIRED under the amount field and PROMOTION_LEVEL_NOT_HIGHER under level  (05 §5.5 C row 3)

## M web: modal outcomes and preview
[x] C  after success, the modal closes and the history refreshes  (05 §5.5 C row 5)
[x] C  EMPLOYEE_TERMINATED closes the modal, refreshes and toasts the detail  (+ 04 §8.6)
[x] C  the preview shows the same change % as the history row for the same amounts (+ 06 acceptance 2; Q1 (a))

Access by role for S1/S2: rows added to EXPECTED_ACCESS in apps/api/src/http/access-matrix.test.ts (D-054) in cycles G and J.

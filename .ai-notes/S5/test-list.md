# S5 test list ("+" = no 05 row; derived from the 04 contract)

## A employees: E2 detail
[x] I  returns one employee with band min, mid and max, compa-ratio and timestamps  (+ 04 §5.4 E2)
[x] I  returns 404 EMPLOYEE_NOT_FOUND for an unknown id and 400 for a non-integer id  (+ 04 §5.4 E2)

## B api: R2 pay band
[x] I  returns the pay band for a country, job title and level  (+ 04 §5.3 R2)
[x] I  returns 404 PAY_BAND_NOT_FOUND for a combination with no band  (+ 04 §5.3 R2)

## C shared: schemas
[x] U  PersonName rejects empty names, names over 100 characters and names starting with =, +, -, @ or a tab  (05 §5.4 U row 1)
[x] U  CreateEmployeeBody rejects unknown keys, a hire date before 1990-01-01 and an amount outside 1 to 10^12  (+ 04 §5.4 E3)
[x] U  UpdateEmployeeBody rejects an empty object  (+ 04 §5.4 E4)

## D employees: create
[x] I  creating an employee returns 201 with Location, the next employee code, and a hire history row on the hire date  (05 §5.4 I row 1)
[x] I  the new employee's current-salary columns equal the hire row  (05 §5.4 I row 2)

## E employees: create rules
[x] I  rejects a hire date after today with 422 DATE_IN_FUTURE  (05 §5.4 I row 3)
[x] I  rejects a salary in the wrong currency with 422 SALARY_CURRENCY_MISMATCH  (05 §5.4 I row 4)
[x] I  rejects a position with no band with 422 NO_PAY_BAND  (05 §5.4 I row 5)
[x] I  checks the create rules in order: future date, then currency, then band  (+ 04 §5.4 E3)

## F employees: edit
[x] I  editing the last name updates name_search, so a search finds the new name  (05 §5.4 I row 6)
[x] I  rejects a PATCH containing jobTitleId, levelCode or countryCode with 400 naming the key  (05 §5.4 I row 7)
[x] I  edits a terminated employee's details  (+ 04 §5.4 E4)

## G employees: terminate
[x] I  terminating sets status and date and removes the employee from insights  (05 §5.4 I row 8; S5 asserts the default list only, insights half deferred to S7 per Q1)
[x] I  rejects terminating twice, before the hire date, or after today, each with its code  (05 §5.4 I row 9)

## H web: detail page
[x] C  shows the header, salary card with band bar and compa-ratio, and details card  (+ 04 §8.5 S-3)
[x] C  shows Edit details and Terminate to HR Admin and no actions to HR Viewer  (+ 04 §8.5 S-3)
[x] C  shows "Employee not found." for an unknown id  (+ 04 §8.5 S-3, §8.6)
[x] C  a terminated employee's page shows the banner and only "Edit details"  (05 §5.4 C row 4)

## I web: add page
[x] C  the add form shows the band and a "below the band minimum" warning without blocking submit  (05 §5.4 C row 1)
[x] C  maps errors[] from a 400 onto the matching fields  (05 §5.4 C row 2)
[x] C  shows NO_PAY_BAND as a form alert and DATE_IN_FUTURE under the hire date  (+ 04 §8.6)
[x] C  after adding, opens the new employee's page with the "Employee E010251 added." toast  (+ 04 §8.5 S-4)

## J web: edit and terminate modals
[x] C  the edit modal keeps Save disabled until a field changes  (05 §5.4 C row 3)
[x] C  saving the edit modal updates the page and shows "Details updated."  (+ 04 §8.5 S-5)
[x] C  terminating from the modal shows the terminated banner  (+ 04 §8.5 S-7)
[x] C  shows TERMINATION_BEFORE_HIRE under the date and closes on EMPLOYEE_ALREADY_TERMINATED with a toast  (+ 04 §8.6)

## Every API cycle
Add the route's row to EXPECTED_ACCESS in http/access-matrix.test.ts in the red commit (D-054). Finance then gets 403, not 400, on E3 to E5 through the existing test.

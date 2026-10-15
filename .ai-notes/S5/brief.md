# S5 brief: view, add, edit, terminate (branch s5-view-add-edit-terminate)

Rulings (approved): Q1 = (a) S5 proves only that a terminated employee leaves the default list; the insights half of 05 row I8 stays open for S7. Q2 = (a) no "Record salary change" button until S6; HR Admin sees "Edit details" and "Terminate" only.

## Roles (04 §4.5)
`reference.read` all roles: R2. `employee.read` HR Admin, HR Viewer: E2. `employee.write` HR Admin only: E3, E4, E5. Add each route to `EXPECTED_ACCESS` in `http/access-matrix.test.ts` (D-054).

## Endpoints
**R2 `GET /api/pay-bands/:countryCode/:jobTitleId/:levelCode`** (04 §5.3) → `PayBandResponse`
`{ countryCode, jobTitleId, levelCode, min: Money, mid: Money, max: Money }`. 400 malformed params; 404 `PAY_BAND_NOT_FOUND`.

**E2 `GET /api/employees/:id`** (§5.4) → `EmployeeDetail` = list item fields (`id, employeeCode, firstName, lastName, gender, country{code,name}, department{id,name}, jobTitle{id,name}, level{code,name}, status, hireDate, terminationDate, salary, salaryUsd, salaryEffectiveDate, compaRatio, bandPosition`) plus `band{min,mid,max}`, `createdAt`, `updatedAt` (ISO). 400 if `id` not a positive integer; 404 `EMPLOYEE_NOT_FOUND`.

**E3 `POST /api/employees`** `CreateEmployeeBody` `{ firstName, lastName, gender, countryCode, jobTitleId, levelCode, hireDate, startingSalary: Money }`.
"Validation (400): every field required; names are `PersonName`; `hireDate` a valid date not before 1990-01-01; `amountMinor` an integer from 1 to 10^12; unknown keys rejected. Rules (422, checked in this order): `DATE_IN_FUTURE` (hire date after today), `SALARY_CURRENCY_MISMATCH`, `NO_PAY_BAND`. Effects, in one write transaction: assigns `employee_code` (E + zero-padded max id + 1), `status = 'active'`, `name_search`, current-salary columns from the starting salary with `salary_effective_date = hireDate`, and the first history row (reason `hire`, effective date = hire date, position = the given title and level, `changed_by_user_id` = viewer). 201 with header `Location: /api/employees/10251` and the `EmployeeDetail` body. Outside-band starting salaries are allowed (HR decides); the UI warns."

**E4 `PATCH /api/employees/:id`** `UpdateEmployeeBody`: "any non-empty subset of `firstName`, `lastName`, `gender`. The schema is strict, so `jobTitleId`, `levelCode`, `countryCode`, salary fields or any other key give 400 with that key in `errors` (D-029). Allowed on terminated employees. Updates `name_search` and `updated_at`. 200 with `EmployeeDetail`. Errors: 400, 404."

**E5 `POST /api/employees/:id/termination`** `TerminateBody` `{ terminationDate }`. "Rules (422): `EMPLOYEE_ALREADY_TERMINATED`, `DATE_IN_FUTURE`, `TERMINATION_BEFORE_HIRE`. Sets `status`, `termination_date`, `updated_at`. 200 with `EmployeeDetail`." 02 §5: termination date >= hire date and <= today.

Errors are problem+json (04 §4.4); 400 `VALIDATION_FAILED` has `errors[{path,message}]`, dot paths. Example message: "First name can't start with =, +, -, @ or a tab."

## Shared schemas (04 §4.7)
`common.ts`: `PersonName` "(trimmed, 1 to 100 chars, no leading formula character)". `employee.ts`: `EmployeeDetail`, `CreateEmployeeBody`, `UpdateEmployeeBody`, `TerminateBody`. `reference.ts`: `PayBandResponse`.

## Money (02 §4)
Compa-ratio `salary_minor / mid_minor`, 2 decimals. Below `< min`, above `> max`; equal is inside. USD per employee, half up. Format only in web `Money`; compa via `formatCompaRatio`.
`name_search`: "first last", NFKD, diacritics removed, lower-cased, spaces collapsed (02 §5).

## UI (04 §8.5, §8.6)
S-3 `/employees/:id`: header (name, ID, status badge, `Software Engineer, L3 Senior, India`, hire date); terminated banner "Terminated on 9 Oct 2026. Excluded from current insights. History is kept."; salary card (local, USD, effective date, band bar min/mid/max + marker, compa-ratio, "Below band"/"Above band" text); details card (first, last, gender, country, department); history = placeholder (S6). Actions HR Admin only: "Edit details" (always), "Terminate" (active only). HR Viewer: none. Loading skeletons; 404 "Employee not found." + link to list; error alert + "Retry".
S-4 `/employees/new`: fields First name, Last name, Gender, Country (currency shown by salary), Job title, Level, Hire date (max `me.today`), Starting salary. Band preview via R2 when country/title/level chosen: min, mid, max, compa-ratio; yellow "This is below the band minimum." (or above) without blocking. Shared zod first, then server; `errors[]` to fields by path. Success: navigate to detail, toast "Employee E010251 added." Cancel back to list keeping URL filters.
S-5 edit modal: First, Last, Gender; title/level/country read-only with "Change title or level by recording a salary change." Save disabled until a change. Toast "Details updated."
S-7 terminate modal: date (default and max today, min hire date). "Terminating removes {name} from current insights. Their record and salary history are kept. This can't be undone in this version." Red "Terminate".
8.6: `VALIDATION_FAILED` per field, unmatched in form alert; `NO_PAY_BAND` form alert "There's no pay band for this country, job title and level."; `SALARY_CURRENCY_MISMATCH` amount field; `DATE_IN_FUTURE`, `TERMINATION_BEFORE_HIRE` date field; `EMPLOYEE_ALREADY_TERMINATED` close modal, refresh, toast `detail`; `EMPLOYEE_NOT_FOUND` not-found state.

## 05 §5.4 rows (verbatim; all owned by S5)
U `PersonName` rejects empty names, names over 100 characters and names starting with `=`, `+`, `-`, `@` or a tab
I creating an employee returns 201 with `Location`, the next employee code, and a `hire` history row on the hire date
I the new employee's current-salary columns equal the hire row
I rejects a hire date after today with 422 `DATE_IN_FUTURE`
I rejects a salary in the wrong currency with 422 `SALARY_CURRENCY_MISMATCH`
I rejects a position with no band with 422 `NO_PAY_BAND`
I editing the last name updates `name_search`, so a search finds the new name
I rejects a PATCH containing `jobTitleId`, `levelCode` or `countryCode` with 400 naming the key
I terminating sets status and date and removes the employee from insights
I rejects terminating twice, before the hire date, or after today, each with its code
C the add form shows the band and a "below the band minimum" warning without blocking submit
C maps `errors[]` from a 400 onto the matching fields
C the edit modal keeps Save disabled until a field changes
C a terminated employee's page shows the banner and only "Edit details"

## Acceptance (06 S5)
"A PATCH with `jobTitleId` is rejected with 400 naming the key; a terminated employee disappears from the default list and the insights headcount (insights checked again in S7)." Cut 4: band bar as min/mid/max text; drop live band preview (keep 422).

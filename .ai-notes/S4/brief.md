# S4 brief (Search, filters, sort, CSV export). Branch s4-search-filters-export

## Rulings from the user (docs silent; "all A")
1. Shared zod schema is shape-only (comma split, trim, drop empties, dedupe, enums for status/band/sort/order, date). API service checks country/department/jobTitle/level/gender values against reference tables: 400 VALIDATION_FAILED, errors[].path like `country[1]`. Web drops values absent from `['reference']` data.
2. CSV Gender cell = reference `name` (non_binary -> `Non-binary`).
3. CSV Compa-ratio always 2 decimals (`1.00`).

## E1 GET /api/employees (04 5.4); 400 VALIDATION_FAILED incl. unknown params
q: trimmed 1-100 chars. If matches `^E?0*(\d{1,6})$` (ci): exact `employee_code = 'E'+zero-pad-6(digits)`. Else normalise like name_search (02 s5) and `instr(name_search, ?) > 0` (no LIKE escaping).
status active|terminated|all (default active); country, department, jobTitle, level, gender: lists; department -> `job_title_id IN (...)` (I4), combined with jobTitle by AND.
band below|above|outside|inside: below `salary_minor < min_minor`, above `> max_minor`, outside either, inside neither (equal to min/max is inside).
salaryUnchangedSince date: `salary_effective_date < ?`.
sort name|salaryUsd|hireDate (default name = last_name, first_name, id); order asc|desc (default asc). Every sort ends with `id` tie-breaker.
All filters AND; values within one list OR. Item shape, page/pageSize/total/totalPages/fxAsOf unchanged from S3.
4.6: lists are one param, comma-separated, no spaces (`country=IN,US&level=L3,L4`); empty dropped; duplicates removed; booleans `true|false`. Web builds URLs with the same schema's serializer.

## X1 GET /api/exports/employees.csv (04 5.7), action `export.employees`: HR Admin yes, HR Viewer yes, Finance no
Takes E1 params except page/pageSize (`EmployeeExportQuery`); all matching rows (<=10,250) in E1 sort order.
Headers: `Content-Type: text/csv; charset=utf-8`; `Content-Disposition: attachment; filename="employees-2026-10-09.csv"` (date from clock); `Cache-Control: no-store`.
Columns in order: Employee ID (E004217) | First name | Last name | Gender (Female) | Country (India) | Department | Job title | Level (L3 Senior) | Status (Active/Terminated) | Hire date | Termination date (YYYY-MM-DD, empty if none) | Salary (1980000.00 major units, 2 dp, no grouping) | Currency | Salary (USD) (22770.00) | FX as of (2026-09-30) | Compa-ratio (0.97) | Band position (Below/Inside/Above) | Salary effective date.
D-044: UTF-8 BOM, CRLF, every field double-quoted, `"` doubled; text starting `=`,`+`,`-`,`@`,tab,CR gets a tab prepended inside the quotes. Pure `modules/employees/csv.ts`, rows -> string.
Permissions 4.5: `employee.read` (E1) HR Admin/HR Viewer only; Finance no.

## Web (04 8.3 URL state, 8.5 S-2)
`useEmployeeFilters` parses with shared schema; defaults omitted from URL; any filter change resets page to 1; discrete changes push history, search typing (debounced 300 ms) replaces; invalid URL value dropped, URL rewritten, notice "Some filters in this link weren't recognised and were removed."
Filter bar: search (placeholder "Search name or employee ID"); multi-selects Country, Department, Job title (options narrowed to chosen departments), Level, Gender; selects Status (Active, Terminated, All), Pay band (Any, Below band, Above band, Outside band, Inside band); date input "No salary change since"; "Clear filters". Sortable headers: Name, Salary (by USD), Hire date.
"Export CSV" (HR roles): downloads via API client as blob, spinner while fetching. Empty filtered: "No employees match these filters." + "Clear filters".
Compa-ratio 2 dp (8.4.1). Money formatted only in the web Money component.

## Test rows owned
05 5.3 (not done in S3): U row 1 comma part, U rows 3-4, I rows 3-11, C rows 2-5, C row 7 Export half. 05 5.7: all 7 rows. Verbatim text and mapping in test-list.md.

## ADR / decisions
0005 Fastify+zod problem details: bad params -> 400 VALIDATION_FAILED with `errors[{path,message}]`. D-039 comma lists, unknown params rejected. D-044 CSV format.

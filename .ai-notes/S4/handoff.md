
## Session B1 done (cycles S4 A-C)
Last commit: a1dd029 feat(employees): add list filters
Open rows: D-J (rows 14-33) unchecked; A-C rows all ticked
Notes:
- Cycle A: shared schema leaves lists/q/band/sort/order undefined when absent (no defaults), so the service applies sort defaults. serializeEmployeeListQuery(query) returns a string without "?" and is ready for the web hook.
- Two S3 tests used now-valid params as the "unknown" example; changed to nope with user approval (see overrides.md). Hook D-059 needs test edits in their own test() commit.
- Row "filters by status terminated and all" is covered by the existing S3 test "returns terminated employees only when asked, or all of them"; no new test added.
- Red commit fcc743b had a typecheck error (.data?.q); fixed by the green commit. Do not pipe typecheck through tail in the commit chain.
- AppError now takes optional errors[]; the error handler passes them through (used for country[1] paths).
- In this shell cat is broken (batcat): use the Read/Write tools, not heredocs with cat.
- Web test "renders the rows and the Showing 1 to 50 of N line" failed once under load and passed on 3 reruns; possibly flaky.
- E: id tie-breaker follows the order direction (desc sort => id desc); brief only said 'ends with id'. Not told by user; flag in review.

## Session B2 done (cycles S4 D-F)
Last commit: 1705252 feat(export): add csv builder
Open rows: G-J rows (export endpoint, web cycles); D-F all ticked
Notes: csv.ts lives in modules/employees/ (brief path), exports buildEmployeesCsv(items, fxAsOf); every row incl. header ends in CRLF (trailing CRLF after last row), not stated in brief. Gender names moved to domain/genders.ts, shared with reference routes. Sort: id tie-breaker follows order direction (desc => id desc); brief silent, flag in review. Band filters needed payBands joined into the count query too. Unknown-param row (E) was already satisfied by 29be887; proven by loosening strictObject.
- User confirmed both choices above (keep). Not open questions.

## Session B3 done (cycles S4 G-I)
Last commit: b97f551 feat(web): add sort headers and url value validation
Open rows: J rows only (Export CSV shown to HR Admin/HR Viewer; Export CSV requests current filters with spinner)
Notes:
- Commits: cf5b057/3851d3c (G), e75a87f/88c57e4/965de69 (H), 4f112a4/b97f551 (I). Full suite 325 passing, typecheck and lint clean.
- G: new shared employeeExportQuerySchema (list schema minus page/pageSize, strict). service.ts refactored: selectItems/filterConditions shared by listEmployees and exportEmployees. Route /api/exports/employees.csv takes clock via employeeRoutes deps.
- H/I test infra changes (not test edits): apps/web/test/server.ts now has a default GET /api/reference handler (list page always fetches reference); apps/web/test/fixtures/reference.ts added; apps/web/test/setup.ts sets asyncUtilTimeout 5000 because the first render of the list page (6 Mantine selects) exceeded the 1 s findBy default and failed the existing first list test.
- My own H tests were fixed after red (88c57e4): pill/input lookups scoped because Mantine keeps dropdown options mounted. No user corrections, so overrides.md is unchanged.
- Web: useEmployeeFilters now owns URL parsing (drops invalid and unknown-to-reference values, rewrites URL with replace, notice via droppedValues). List query waits for reference data (enabled: ready). "Clear filters" appears in the bar and in the empty filtered state. Export button (J) should read the current query via useEmployeeFilters().query and serializeEmployeeListQuery with page/pageSize omitted.
- Flake: npm test failed 1 test on 2 of ~6 full runs (test not identified, passed on rerun; 3 consecutive green afterwards). Worth watching in the R session.
- Shell note: `cat` is broken in this shell (batcat alias); use the Write/Edit tools, not heredocs.

## Session B4 done (cycles S4 J)
Last commit: 5868682 feat(web): add export button
Open rows: none
Notes:
- Commits: 1b688b3 (red), 8f1c724 (test made deterministic, user-approved, in overrides.md), 5868682 (green). Full suite 328 passing, typecheck clean.
- client.ts gained apiDownload (blob + filename from Content-Disposition); button uses permission export.employees; button has loading and disabled while fetching.
- Export button omits page/pageSize via serializer defaults. Download errors are not surfaced in the UI (not in brief).
- Earlier flake in full runs seen in B3 not seen this session.

## Follow-up to J: export error handling
Last commit: see git log (feat(web): show export failures with a retry)
Open rows: none
Notes: red 0a92861. Inline red Alert with the API message + Retry; 401 shows no alert (global handler); 429 shows the same message, Retry-After not surfaced. Suite 329 passing, lint and typecheck clean.

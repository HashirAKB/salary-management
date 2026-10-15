- A green: user approved replacing the now-valid unknown-param examples (q in shared test, country=IN in api routes test) with 'nope'. Assertion unchanged.

- Confirmed by user (B2): keep id tie-breaker following the order direction, and keep CRLF after every CSV row including the last. No change needed; do not re-flag.

- test(web) EmployeeExport spinner test: replaced delay(150) with a promise the test releases (race under load). User approved option 1.

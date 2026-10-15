# S0 test list

| # | Done | Lvl | it(...) | Source | Cycle |
|---|---|---|---|---|---|
| 1 | [x] | U | rejects a missing DATABASE_URL and lists every invalid variable | 05 §5.0 U row 1 | A |
| 2 | [x] | U | applies the documented defaults when optional variables are absent or empty | 03 §8 (added) | A |
| 3 | [x] | U | requires DATABASE_AUTH_TOKEN when NODE_ENV is production | 03 §8 (added) | A |
| 4 | [x] | U | fixedClock returns its instant and its UTC date, and moves only on advance | 05 §4.3, 06 S0 scope (added) | B |
| 5 | [x] | U | systemClock reads the current system time | 06 S0 scope (added) | B |
| 6 | [x] | U | the problem builder sets type about:blank and the status phrase as title | 05 §5.0 U row 2 | C |
| 7 | [x] | U | turns zod errors into errors[] with dot-joined paths | 05 §5.0 U row 3 | C |
| 8 | [x] | I | an unknown /api path returns a 404 problem with code ROUTE_NOT_FOUND | 05 §5.0 I row 5 | D |
| 9 | [x] | I | a write with a non-JSON body returns 415 UNSUPPORTED_MEDIA_TYPE | 05 §5.0 I row 7 | D |
| 10 | [x] | I | an unexpected error returns 500 INTERNAL with no stack trace in the body | 05 §5.0 I row 8 | D |
| 11 | [x] | I | GET /api/health returns 200 with { status: "ok" } | 05 §5.0 I row 9 | E |
| 12 | [x] | I | GET /api/health returns 503 DB_UNAVAILABLE when the database can't answer | 04 §5.1 (added) | E |
| 13 | [x] | C | renders the app shell placeholder with the API status through the test wrapper | 06 S0 canary, 05 OQ 2 | F |
| 14 | [x] | I | a non-API path returns index.html when static serving is on | 05 §5.0 I row 6 | G |
| 15 | [x] | I | an unknown /api path is still a ROUTE_NOT_FOUND problem when static serving is on | 05 §5.0 I row 5 | G |

# Performance at 10,000 employees

Measured with `npm run perf` (`scripts/perf.ts`) on 2026-10-11. The numbers below are the output of that run, unedited apart from layout.

## Method

- A throwaway SQLite file is seeded with `npm run seed` data: 10,250 employees (10,000 active, 250 terminated). `DATABASE_URL` is never read, so no real database is touched.
- The real app is served on a real socket and every request goes over HTTP as HR Admin, so the times include auth, validation, the query and JSON serialisation.
- Each request is run 3 times to warm up, then 30 times. The table shows the median, the 95th percentile and the slowest run.
- The run is repeated after dropping all 9 indexes from 0001_init.sql (I2 to I7, I12 to I14) on the same file.
- No stored USD column exists; the salary sort converts per employee at query time (02 section 10 Q7).

## Machine

| | |
| --- | --- |
| CPU | 12th Gen Intel Core i5-1235U, 12 logical CPUs |
| Memory | 15 GiB |
| OS | Linux x64 |
| Node | v24.21.0 |
| Runs | 30 per request, after 3 warm-up runs |

## Results (milliseconds)

| Request | Budget | Median | p95 | Max |
| --- | --- | --- | --- | --- |
| List, default page (page 1, 50 rows, name order) | 300 | 7.7 | 12.2 | 12.8 |
| List, sorted by salary in USD (descending) | 300 | 16.2 | 22.6 | 24.4 |
| Insights summary (I1) | 500 | 120.9 | 132.3 | 133.2 |
| Pay distribution by country (I2) | 500 | 116.1 | 139.7 | 141.9 |
| Pay equity (I3) | 500 | 90.0 | 94.8 | 105.8 |

Without the 9 indexes:

| Request | Budget | Median | p95 | Max |
| --- | --- | --- | --- | --- |
| List, default page (page 1, 50 rows, name order) | 300 | 11.5 | 12.0 | 13.6 |
| List, sorted by salary in USD (descending) | 300 | 12.0 | 13.3 | 14.8 |
| Insights summary (I1) | 500 | 116.2 | 136.3 | 141.0 |
| Pay distribution by country (I2) | 500 | 109.3 | 128.6 | 128.7 |
| Pay equity (I3) | 500 | 86.5 | 93.0 | 98.5 |

## Reading the numbers

- Every request is well inside its budget: the list budget is 300 ms (F2) and the insights target is 500 ms (04 section 11 Q3). The slowest p95 is 139.7 ms.
- The USD sort needs no stored column. It is 16.2 ms at the median.
- At this size the indexes make little difference to these requests. Only the default list is clearly slower without them (11.5 ms against 7.7 ms median); the other differences are within the run to run spread of a single run of 30. The indexes were not shown to matter here, and this run does not justify more of them.
- The insights requests load the whole active projection in process, and that is where the time goes (about 90 to 120 ms), with or without indexes.
- The in-process cache fallback (08 section 6) was not built: measurement does not call for it.

Not measured: the first Ask call against the 15 second timeout (08 section 6, step 6, optional), and the live Render and Turso deployment, which adds network latency to every figure above.

## Reproduce

```
npm ci
npm run perf
```

`PERF_RUNS=100 npm run perf` changes the run count. Expect different absolute numbers on other hardware.

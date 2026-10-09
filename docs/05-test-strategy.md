# 05 Test strategy

Chat 5 output. What gets tested at which level, the tooling, the rules that keep tests fast and deterministic, a test list per feature, and the "Ask about pay" eval set.
Inputs: `decisions.md`, `01-requirements.md`, `02-data-model.md` (section 7.12 seed tests), `03-architecture.md`, `04-api-and-ui.md`, ADRs 0003, 0004, 0005, 0008.
Goes into the repo as `docs/05-test-strategy.md`. The build plan (06) copies each feature's test list into its slice; that list is the slice's starting point, written before any code (Kent Beck's test list).
Updated in Chat 7: slice labels in section 5 headings follow `06-build-plan.md` (D-056), and section 7 points at D-058. No new decisions. 06 is the source of truth for which slice owns which row.

## 1. Decisions this file settles (proposed; logged at the end of Chat 6)

| ID | Decision | Why | Rejected alternatives |
| --- | --- | --- | --- |
| D-048 | Four levels. Unit tests for pure code (domain, shared, formatting, CSV, answer templates). API integration tests through `app.inject()` against a fresh in-memory libSQL database per test. Web component tests in jsdom with Testing Library and MSW. One Playwright smoke test against the built app. Plus a manual eval run for Ask, outside the suite | Most product risk sits in rules (money, percentiles, pay equity, salary changes, permissions), so most tests are fast units. Routes are tested with the real database because the SQL is part of the behaviour. The browser layer gets one end-to-end path, since everything below it is already covered | Mock-heavy service tests with stubbed repositories (pass while the SQL is wrong). Many E2E tests (slow, flaky, duplicate lower levels). No E2E (nobody checks that the built bundle, static serving and cookies work together) |
| D-049 | Component tests mock the API at the network edge with MSW, not by injecting a fake client | Tests run the real API client (problem parsing, waking detection, URL encoding) and real TanStack Query. App code needs no test-only seams. Settles 03 open question 4 | A fake client passed through React context (skips the client code that most needs testing) |
| D-050 | Contract bridge: every API integration test parses each 2xx body with the shared response schema, and every MSW fixture is built by a fixture builder that parses with the same schema | API and web tests can't drift apart silently. A changed response shape fails on both sides without needing more E2E tests | OpenAPI contract tests (a second contract format next to zod); trusting types alone (types vanish at runtime) |
| D-051 | Determinism rules: an injected clock fixed at `2026-10-09T09:00:00.000Z`; a lint rule bans `new Date()`, `Date.now()` and `Math.random()` outside `domain/clock.ts` and the seed's random module; `TZ=UTC` and explicit locales in test scripts; no network (MSW `onUnhandledRequest: 'error'` in web; `fetch` replaced by a throwing stub in API tests); timers in the web connection store come from an injected scheduler | Every run produces the same result on any machine and any day. A lint rule catches a stray clock read in review instead of in a flaky test | Fake global timers everywhere (interact badly with MSW and promises); trusting reviewers to spot clock reads |
| D-052 | Coverage with the v8 provider. No global threshold. A floor of 90% lines and 85% branches on `apps/api/src/domain/**` and `packages/shared/src/**`, enforced in CI | Rules code is where a missed branch is a real bug. A global number invites tests written for the metric. The test lists below, not a percentage, are the main evidence | A global 80% threshold; no coverage report at all |
| D-053 | The Ask eval set is 15 questions with expected structured queries in `apps/api/evals/ask-eval.json`. `npm run eval` runs the real interpreter by hand, scores exact matches and writes `docs/evals/ask-eval-<date>.md`, which is committed. Pass bar: 13 of 15 before the demo. Not part of CI | Measures translation quality where it can actually fail, without putting an API key or a paid, non-deterministic call in CI. Committed reports show each prompt change and its effect | Running evals in CI (needs a secret, costs money, flaky by nature); no eval (the AI feature's quality would be unmeasured) |
| D-054 | Permissions are tested as a matrix: `buildApp` records every route with its action, and one table-driven test calls every route as every role (and logged out), checking 401, 403 or "not 401/403". A second test fails if any registered route is missing from the expected-access table | Covers "one test per role for each endpoint" for every endpoint, including future ones, in one place. A new route without an access decision fails the build | Hand-written role tests per route (easy to forget one) |
| D-055 | Vitest 5 (pinned exactly), replacing Vitest 4 in D-038. Amendment A-005 | Vitest 5.0 shipped on 3 Sep 2026, after Chat 3. A new repo has nothing to migrate, inline projects now inherit the root config, and `clearMocks` defaults to on. Requires Node 22.12+ and Vite 6.4+, both met by the pinned LTS and Vite | Staying on 4.1 (an older major for no reason). Fallback if anything breaks at S0: Vitest 4.1 pinned, noted in the S0 commit |

## 2. Changes this file makes to earlier docs

| Doc | Change | Reason |
| --- | --- | --- |
| `decisions.md` D-038 | "Vitest 4" becomes "Vitest 5" (A-005) | D-055 |
| `03-architecture.md` section 2 and section 5 | Vitest 5; `test/` gains `fixtures/` (MSW fixture builders) in `apps/web` and `evals/` in `apps/api` | D-049, D-053, D-055 |
| `03-architecture.md` open question 4 | Resolved: MSW | D-049 |
| `03-architecture.md` 7 | Password hashing parameters are read from config. Tests use N=2^10 (fast); one test asserts the production default N=2^15, r=8, p=3 | Keeps a login test under a few ms; the production setting is still pinned by a test |
| `04-api-and-ui.md` 8.3 | The connection store takes an injected scheduler (`setTimeout`, `clearTimeout`, `now`) | D-051 |

## 3. Tooling

| Tool | Use | Notes |
| --- | --- | --- |
| Vitest 5.0.x (exact pin) | All unit, integration and component tests | One root `vitest.config.ts` with inline projects `shared`, `api`, `web`. Projects inherit root config in Vitest 5 |
| `@vitest/coverage-v8` | Coverage | Thresholds as D-052, set with glob keys under `coverage.thresholds` |
| Fastify `app.inject()` | HTTP integration tests | In-process, no port. No supertest |
| `@libsql/client` with `:memory:` | Database in API tests | Fresh client per test (4.1) |
| jsdom | Web test environment | Mantine's own Vitest guide uses jsdom |
| `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event` | Component tests | Queries by role and label, never by class name |
| MSW (v2 API: `http`, `HttpResponse`, `setupServer` from `msw/node`) | API mocking in web tests | `listen({ onUnhandledRequest: 'error' })`, `resetHandlers()` after each test |
| `@playwright/test`, Chromium only | One smoke test | `webServer` starts the built app |
| ESLint `no-restricted-syntax` and `no-restricted-imports` | Determinism and layering rules (D-051, ADR 0004) | Fails CI, not a warning |

Exact versions are pinned at S0 (no `^`) and recorded in the S0 commit message.

### 3.1 Config shape

```ts
// vitest.config.ts (root)
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', root: 'packages/shared', environment: 'node' } },
      { test: { name: 'api', root: 'apps/api', environment: 'node', setupFiles: ['test/setup.ts'] } },
      { test: { name: 'web', root: 'apps/web', environment: 'jsdom', setupFiles: ['test/setup.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**', 'apps/api/src/**', 'apps/web/src/**'],
      thresholds: {
        'apps/api/src/domain/**': { lines: 90, branches: 85 },
        'packages/shared/src/**': { lines: 90, branches: 85 },
      },
    },
  },
});
```

`apps/api/test/setup.ts` replaces `globalThis.fetch` with a function that throws "Network is disabled in tests".
`apps/web/test/setup.ts` follows Mantine's Vitest guide (jest-dom matchers, `getComputedStyle` wrapper, `scrollIntoView` stub, `matchMedia` and `ResizeObserver` mocks), starts the MSW server, and exports `render` wrapped in `MantineProvider`, `QueryClientProvider` (retries off) and a `MemoryRouter`.

### 3.2 Commands

| Command | Runs | Budget |
| --- | --- | --- |
| `npm test` | All three Vitest projects | Under 30 s locally, under 60 s in CI |
| `npm test -- --project api` | One project | |
| `npm run test:coverage` | All projects with coverage and the D-052 floor | CI runs this one |
| `npm run e2e` | Builds, seeds an e2e database, runs Playwright | Under 2 minutes in CI |
| `npm run eval` | The Ask eval set against the real model (needs `ANTHROPIC_API_KEY`) | Manual only |

Every script sets `TZ=UTC`. A single test file over 2 seconds is a smell to fix, not to accept.

## 4. Rules every test follows

### 4.1 Database

- `testApp()` in `apps/api/test/helpers.ts` creates a new `:memory:` client, runs the real migrations, inserts reference data with `aReferenceSet()`, and calls `buildApp({ db, clock: fixedClock(...), interpreter: new FakeInterpreter(...), config: testConfig })`. Each test gets its own app and database, so test order never matters.
- A libSQL in-memory database exists only on the connection that created it. The client's current source keeps in-memory pools at one connection for this reason. Two consequences:
  - Code inside a transaction uses only the transaction handle (Drizzle's `tx`), never the outer `db`. Otherwise the in-memory test waits forever for the one connection, and production holds a write lock for nothing.
  - A guard test writes in a transaction and then reads through the client. If a client upgrade ever reopens connections, this test fails first. The fallback is a uniquely named shared-cache URL per test (`file:test-<id>?mode=memory&cache=shared`).
- Tests never mock repositories. A service test is an integration test through `app.inject()`. One exception, named in its test: the atomicity test for salary changes injects a repository that fails on its second write (F4 below), because no real input makes that write fail.
- The full 10,000-employee seed runs in exactly one test file (`seed.int.test.ts`), once in `beforeAll`, for read-only invariant checks. Every other test builds the few rows it needs.

### 4.2 Test data builders (`apps/api/test/builders/`)

| Builder | Default | Example |
| --- | --- | --- |
| `aReferenceSet()` | The seed's FX rates, countries, departments, titles, levels and all 250 bands (from the seed's pure band generator) | `aReferenceSet().withoutBand('IN', SOFTWARE_ENGINEER, 'L5').insert(db)` |
| `anEmployee()` | Active, India, Software Engineer, L3, female, salary at band mid, hire date 2022-01-10, one `hire` row | `anEmployee().inCountry('US').atLevel('L2').withSalary(9_500_000).hiredOn('2020-03-01').insert(db)` |
| `.withHistory([...])` on `anEmployee()` | Hire row only | `.withHistory([merit('2023-04-01', 4.0), promotion('2024-04-01', 'L3', 12.0)])` keeps the current-salary columns equal to the last row |
| `aUser(role)` | Email `<role>@test.local`, password `test-password-123` hashed with test parameters | `aUser('finance').insert(db)` |
| `loggedInAs(app, role)` | Inserts a user and a session row directly, returns the cookie header | Skips the login route, so only login tests pay for hashing |
| `anAskLogRow()` | Answered, today, user 1 | Used to fill caps |

Builders give each row a sequential id per test. No randomness. Values a test asserts on are set explicitly in that test, never left to a default.

Web fixtures (`apps/web/test/fixtures/`): `anEmployeeListItem()`, `anEmployeeDetail()`, `aMeResponse(role)`, `aSummary()`, `anAskAnswer()` and so on. Each `build()` parses its output with the shared response schema (D-050).

### 4.3 Clock and time

- API: `fixedClock('2026-10-09T09:00:00.000Z')` with `advance(ms)`. Today is `2026-10-09`.
- Web: dates come from the `me` fixture's `today`. Timers in the connection store come from a manual scheduler with `tick(ms)`.
- No test sleeps.

### 4.4 Naming and shape

- File names: `<unit>.test.ts(x)` next to the code. Route tests are `routes.test.ts` in each module.
- `describe` names the unit or endpoint; `it` states a behaviour in plain words: `it('rejects a merit raise that changes the level')`. A failing test name reads as a bug report.
- Arrange, act, assert, with one behaviour per test. Table-driven tests (`it.each`) for rule tables and formatting cases.
- Assertions check outcomes the user or a caller sees (status, `code`, body fields, rows in the database, text on screen), never private calls.

### 4.5 What we don't test

- Mantine, Drizzle, Fastify, TanStack Query or zod themselves.
- The SQL strings Drizzle generates. We test the rows that come back.
- Styling, layout and colours. Snapshot tests: none.
- Getters and pass-through functions with no logic.
- The real Anthropic API inside the suite (only in the eval run).
- Performance (Chat 8 measures it with a script and records numbers in `docs/performance.md`).

## 5. Test lists per feature

Levels: **U** unit, **I** API integration, **C** component, **E** end to end. Each line is one test (or one `it.each` table).

### 5.0 Cross-cutting (slice S0 and S1)

| Level | Test |
| --- | --- |
| I | runs every migration on an empty database, and running them again changes nothing |
| I | every Drizzle table's columns equal `PRAGMA table_info` for that table (schema drift, ADR 0003) |
| I | rejects a row that breaks a foreign key (foreign keys are on) |
| I | keeps data written in a transaction visible to the next read on an in-memory database (guard, 4.1) |
| I | an unknown `/api` path returns a 404 problem with code `ROUTE_NOT_FOUND`, not the web app |
| I | a non-API path returns `index.html` when static serving is on (temporary dist folder fixture) |
| I | a write with a non-JSON body returns 415 `UNSUPPORTED_MEDIA_TYPE` |
| I | an unexpected error returns 500 `INTERNAL` with no stack trace in the body (test-only route) |
| I | `GET /api/health` returns 200 with `{ status: "ok" }` |
| I | authenticated responses carry `Cache-Control: no-store` |
| I | logs redact the cookie header, `password` and any `*Minor` field (captured pino stream) |
| U | `config` rejects a missing `DATABASE_URL` and lists every invalid variable |
| U | the problem builder sets `type: about:blank` and the status phrase as `title` |
| U | zod errors become `errors[]` with dot-joined paths |

### 5.1 Seed (S1; from 02 section 7.12)

| Level | Test |
| --- | --- |
| U | the same seed gives a deep-equal dataset, and the hash of its ordered rows matches the recorded value |
| U | creates exactly 10,000 active and 250 terminated employees, with per-country counts from 02 section 7.3 |
| U | gives every employee a band, and every band has min < mid < max |
| U | starts each history with a `hire` row on the hire date, keeps dates increasing, ends no later than the reference or termination date, and ends on the current salary, title and level |
| U | changes level only on `promotion` rows, one rank up |
| U | lands the four target cohorts within 0.1 points of their gap, with the expected flags, and keeps every other eligible cohort under 2.5% |
| U | keeps the outside-band share between 5% and 8% and the stale share between 9% and 13% |
| U | `largestRemainder` allocates counts that sum exactly to the total |
| U | the seeded normal generator returns the same values for the same seed |
| I | the seed CLI exits with an error when a demo password variable is missing or shorter than 12 characters |
| I | after `writeDataset`, every employee's current-salary columns equal their latest history row (`seed.int.test.ts`) |
| I | running the seed twice leaves identical domain data and resets sessions and `ask_log` |

### 5.2 F1 Login and roles (S2)

| Level | Test |
| --- | --- |
| U | the permissions table matches 04 section 4.5, action by action |
| U | `aggregateMinGroupSize` is 5 for Finance and 1 for the HR roles |
| U | password hashing round-trips, and a wrong password fails the comparison |
| U | the production hash string uses `scrypt$32768$8$3$` |
| I | logging in with correct details returns the `me` body and sets an `HttpOnly`, `SameSite=Lax` cookie |
| I | the cookie is `Secure` when `NODE_ENV` is `production` |
| I | a wrong password and an unknown email return the same 401 body |
| I | the 11th login attempt in a minute from one IP returns 429 with `Retry-After` |
| I | the session table stores the token's hash, not the token |
| I | a session older than 8 hours returns 401 (clock advanced) |
| I | logout deletes the session, and the old cookie then returns 401 |
| I | logout without a session returns 204 |
| I | `me` returns the role's permissions, `today` from the clock, and `askEnabled: false` without an API key |
| I | **access matrix (D-054):** every route, called logged out, returns 401 except the public ones |
| I | **access matrix:** every route, called as each role, returns 403 exactly when 04 section 4.5 says the role lacks the action |
| I | **access matrix:** a Finance user sending an invalid body to a write route gets 403, not 400 (D-043) |
| I | every registered route appears in the expected-access table |
| C | shows "Email or password is incorrect." on a 401 |
| C | shows the wait in seconds on a 429 |
| C | sends HR roles to `/employees` and Finance to `/insights` after login |
| C | honours `?next=` only when the role may open that route |
| C | shows the forbidden page, not a redirect, when Finance opens `/employees` |
| C | hides "Ask about pay" in the nav when `askEnabled` is false |

### 5.3 F2 Employee list (S3, S4)

| Level | Test |
| --- | --- |
| U | the list query schema applies defaults, splits and de-duplicates comma lists, and rejects unknown params |
| U | `pageSize` accepts only 25, 50 and 100 |
| U | the search parser turns `4217`, `E4217` and `e004217` into code `E004217`, and anything else into a normalised name |
| U | name normalisation removes diacritics, lower-cases and collapses spaces (`"  Jürgen  MÜLLER "` to `"jurgen muller"`) |
| I | returns active employees sorted by last name, 50 per page, with `total` and `totalPages` |
| I | a page past the end returns no items and the real total |
| I | finds "Müller" when searching for "muller" |
| I | finds an employee by code with or without the `E` and leading zeros |
| I | treats `%` and `_` in the search text as literal characters |
| I | filters by country, department, job title, level and gender (`it.each`) |
| I | filters by status `terminated` and `all` |
| I | filters `band=below`, `above`, `outside` and `inside`, counting a salary equal to the band min or max as inside |
| I | filters `salaryUnchangedSince` to employees whose salary date is before that date |
| I | combines different filters with AND and values within one filter with OR |
| I | sorts by USD salary across currencies, with ids breaking ties so no row repeats across pages |
| I | returns each item with salary in local currency and USD, compa-ratio and band position |
| C | renders the rows and the "Showing 1 to 50 of N" line |
| C | changing a filter updates the URL, resets the page to 1 and requests the new query |
| C | loading the page from a URL with filters shows those filters selected |
| C | drops an unknown URL value and shows the "weren't recognised" notice |
| C | shows "No employees match these filters." with "Clear filters" for an empty filtered result |
| C | shows the error alert with "Retry" on a 500 problem |
| C | shows "Add employee" to HR Admin only, and "Export CSV" to both HR roles |

### 5.4 F3 Add, edit, terminate (S5)

| Level | Test |
| --- | --- |
| U | `PersonName` rejects empty names, names over 100 characters and names starting with `=`, `+`, `-`, `@` or a tab |
| I | creating an employee returns 201 with `Location`, the next employee code, and a `hire` history row on the hire date |
| I | the new employee's current-salary columns equal the hire row |
| I | rejects a hire date after today with 422 `DATE_IN_FUTURE` |
| I | rejects a salary in the wrong currency with 422 `SALARY_CURRENCY_MISMATCH` |
| I | rejects a position with no band with 422 `NO_PAY_BAND` |
| I | editing the last name updates `name_search`, so a search finds the new name |
| I | rejects a PATCH containing `jobTitleId`, `levelCode` or `countryCode` with 400 naming the key |
| I | terminating sets status and date and removes the employee from insights |
| I | rejects terminating twice, before the hire date, or after today, each with its code |
| C | the add form shows the band and a "below the band minimum" warning without blocking submit |
| C | maps `errors[]` from a 400 onto the matching fields |
| C | the edit modal keeps Save disabled until a field changes |
| C | a terminated employee's page shows the banner and only "Edit details" |

### 5.5 F4 Salary change and history (S6)

| Level | Test |
| --- | --- |
| U | salary rules return the first violation in the order of 04 section 5.5 (`it.each` over the reason table) |
| U | accepts an effective date equal to the current salary's date |
| U | rejects a date after today and a date before the current salary's date |
| U | merit and market adjustment need a higher amount and the same title and level |
| U | promotion needs a higher amount and a higher level rank, and allows a new title |
| U | correction allows a lower amount, and rejects a change that changes nothing |
| U | `changePct` rounds half away from zero in integer arithmetic: `100000` to `100050` is `0.1`, to `100040` is `0`, to `99960` is `0` (never `-0`), to `99950` is `-0.1`; the hire row's `changePct` is null |
| I | a merit raise returns 201, appends one history row and updates the current-salary columns |
| I | a promotion updates the employee's level, and the history shows the level before and after |
| I | each rule violation returns 422 with its code (`it.each`, one per code) |
| I | a salary change on a terminated employee returns 422 `EMPLOYEE_TERMINATED` |
| I | if the second write fails, neither the history row nor the employee update is kept (injected failing repository, named in the test) |
| I | history lists newest first with previous amount, change % and position before and after |
| I | seeded rows show `changedBy: null`; rows recorded in the app show the recorder's display name |
| I | two changes on the same date are ordered by id |
| C | merit locks title and level; promotion offers only higher levels |
| C | the date field's default and maximum are `me.today` |
| C | shows `RAISE_REQUIRED` under the amount field and `PROMOTION_LEVEL_NOT_HIGHER` under level |
| C | history shows "Imported" for seeded rows, "L2 Intermediate to L3 Senior" for a promotion, and `n/a` in the hire row's Change column |
| C | after success, the modal closes and the history refreshes |

### 5.6 F5 and F6 Insights and pay equity (S7)

Unit fixture: a hand-built list of `PayRow`s with numbers checked in Excel (`PERCENTILE.INC`), stored in `domain/__fixtures__/pay-rows.ts` with the Excel results next to it.

| Level | Test |
| --- | --- |
| U | percentiles match Excel's `PERCENTILE.INC` for `[1,2,3,4]` at 0.25, 0.5 and 0.75 (1.75, 2.5, 3.25) |
| U | a single value is its own P25, median and P75; the input array is not mutated |
| U | USD conversion rounds half up to the cent (`toUsdMinor`) |
| U | total and average are computed from per-employee USD values |
| U | local figures appear only when a group has one currency |
| U | outside-band counts split below and above, and the band limits count as inside |
| U | groups under the minimum size are suppressed with no values; the HR minimum suppresses nothing |
| U | `groupBy: none` returns one `all` group; empty groups are omitted; levels sort by rank, others by name |
| U | gender gap is `(men - women) / men * 100`, positive when women are paid less |
| U | `compaRatio` and `gapPct` round half away from zero from integers (`compaRatio(100500, 100000)` is `1.01`, not floating-point `1.00`; a gap under 0.05% either way is `0`, never `-0`) |
| U | a cohort is flagged at exactly 5.00% and not at 4.99% (unrounded) |
| U | a cohort with 4 women or 4 men is not comparable and carries no numbers |
| U | non-binary and not-disclosed employees count in headcount but not in either mean |
| U | org mean and median gaps are computed in USD |
| I | the TypeScript and SQL USD conversions agree for a table of amounts (02 section 4) |
| I | the summary matches the hand-computed fixture: headcount, payroll by country, outside band, stale count |
| I | the summary excludes terminated employees |
| I | `staleSalaries.since` is today minus two years |
| I | Finance sees a 3-person country as suppressed; HR Admin sees its numbers |
| I | pay distribution groups by each dimension (`it.each`) and applies filters |
| I | pay equity returns the flagged cohort first, hides not-comparable cohorts unless asked, and honours `flaggedOnly` |
| I | Finance and HR get the same pay-equity body (D-047) |
| C | a suppressed row shows "Fewer than 5" |
| C | HR roles see the outside-band and stale cards as links; Finance sees plain counts |
| C | pay equity shows "Too few to compare" rows and a "Review" badge with text on flagged rows |
| C | changing "Group by" updates the URL and the table |

### 5.7 F7 CSV export (S4)

| Level | Test |
| --- | --- |
| U | the CSV starts with a BOM, uses CRLF, and has the 04 section 5.7 header row in order |
| U | doubles quotes inside fields and quotes every field |
| U | prefixes a tab inside the quotes for text starting with `=`, `+`, `-`, `@`, tab or carriage return (`it.each`) |
| U | writes amounts as plain decimals in major units and leaves an empty termination date empty |
| I | the export returns the same employees in the same order as the list for the same filters |
| I | sets `Content-Disposition` with the clock's date in the filename |
| C | "Export CSV" requests the current filters and shows a spinner until the file arrives |

### 5.8 F8 Ask about pay (S8)

| Level | Test |
| --- | --- |
| U | the structured-query zod schema and the generated tool JSON Schema accept and reject the same fixtures |
| U | enum values are matched case-insensitively and normalised (`"software engineer"`, `"l3"`) |
| U | the tool schema has no optional or union parameters (guards the strict limits) |
| U | `genderGap` with a gender filter or `groupBy: gender` becomes `cannot_answer` with reason `unsupported` |
| U | answer templates: one case per row of 04 section 7.6 (`it.each`: ungrouped money, mixed currencies, grouped, empty, suppressed, gap like-for-like, unadjusted gap, negative gap, gap rounding to zero, outside band, headcount) |
| U | each cannot-answer reason maps to its message |
| U | `AnthropicInterpreter` sends the model, `max_tokens: 512`, both tools as strict, `tool_choice: any` and only the question (stub SDK client, no network) |
| U | `AnthropicInterpreter` maps a `run_pay_query` call to a query, and a `refusal` stop reason, a `max_tokens` stop reason or no tool call to an error |
| I | without an API key, `POST /api/ask` returns 503 `ASK_UNAVAILABLE` and writes no log row |
| I | an answerable question returns the answer, the interpreted query and the interpretation list, and logs `answered` with the query JSON |
| I | an unanswerable question returns `kind: cannot_answer` with the template message, logged as `cannot_answer` |
| I | the 31st question of a user's day returns 429 with `Retry-After` to UTC midnight and logs `rate_limited` |
| I | `rate_limited` rows don't count toward the cap |
| I | the global cap of 300 returns 429 with the demo-wide message |
| I | an interpreter error returns 503 `ASK_UPSTREAM_FAILED` and logs `error` |
| I | Finance asking about a group under 5 gets the "fewer than 5" sentence and no numbers |
| I | a 501-character question returns 400 |
| C | shows the answer, the "How I read your question" list and the FX note |
| C | the cannot-answer suggestion fills the question box when clicked |
| C | a 429 shows the reset time; a 503 upstream failure shows "Try again" |
| C | a direct visit with `askEnabled: false` shows the not-set-up message |

### 5.9 Web shell, API client and formatting (S2 onward)

| Level | Test |
| --- | --- |
| U | money formats INR with lakh grouping and other currencies in `en-US` (`INR 20,48,000`, `USD 23,552`) |
| U | dates format as `9 Oct 2026` in UTC whatever the machine's zone |
| U | major-unit input converts to minor units by string parsing (`"0.29"` to 29, `"20480.50"` to 2048050), rejecting a third decimal |
| U | change % displays per 04 section 8.4.1 (`it.each`): `4.2` to `+4.2%` (positive); `-1.0` to `-1.0%` (negative); `0` and `-0` to `0.0%` (exact zero); `0.04` to `0.0%` (positive rounding to zero); `-0.04` to `0.0%` (negative rounding to zero); `null` to `n/a`; `0.05` to `+0.1%` and `-0.05` to `-0.1%` (ties away from zero) |
| U | gap %, share % and compa-ratio display per 04 section 8.4.1 (`it.each`): gap `8.0` to `8.0%`, `-1.2` to `-1.2%`, `0.04` and `-0.04` to `0.0%`, `null` to `Too few to compare`; share `null` to `n/a`; compa `0.97` to `0.97` |
| C | the API client turns a problem response into an `ApiError` with its code |
| C | a request pending over 4 seconds shows the waking banner (manual scheduler) |
| C | a non-JSON or 503 response without a problem body starts the health poll; a 200 health response hides the banner and the failed GET is retried once |
| C | a write that hits a waking server is not retried and shows the "may not have been saved" message |
| C | after 90 seconds of failed polls the banner says the server isn't responding, with "Try again" |
| C | a 401 after login clears the cache and redirects to `/login?next=` with the session-expired notice |

### 5.10 End to end (S9; one Playwright test)

`e2e/smoke.spec.ts`, Chromium, against `npm run build` plus `node apps/api/dist/main.js` with `DATABASE_URL=file:./e2e/.data/e2e.db`. Playwright's `globalSetup` runs the real seed CLI first with test-only demo passwords from the Playwright config, so the run also proves the seed and the production start command.

One test, in order:
1. Log in as HR Admin; land on `/employees`; the toolbar shows 10,000 employees.
2. Filter Country India, Job title Software Engineer, Level L3; the URL carries the filters; the toolbar shows 280.
3. Open the first employee; record a merit increase of 5% dated today.
4. The toast appears and the history's top row is "Merit increase" with `+5.0%`.
5. Log out; log in as Finance; land on `/insights`; the nav has no "Employees".

Not covered by E2E: Ask (no key in CI), pay equity and export (covered by component and integration tests).

## 6. Fake interpreter and the eval set

### 6.1 FakeInterpreter

As 04 section 7.5. Its question-to-result map is built from `apps/api/evals/ask-eval.json`, so the integration tests and the eval share one set of examples. An extra entry maps one question to a query that hits a Finance-suppressed group.

### 6.2 Eval file format

```json
{
  "version": 1,
  "cases": [
    {
      "id": "q01",
      "question": "What is the median pay for a Senior Engineer in India?",
      "expect": {
        "kind": "query",
        "query": { "metric": "median", "groupBy": "none", "filters": { "countries": ["IN"], "departments": [], "jobTitles": ["Software Engineer"], "levels": ["L3"], "genders": [] } }
      },
      "tests": "level word mapping, role word to job title"
    }
  ]
}
```

For `cannot_answer` cases, `expect` is `{ "kind": "cannot_answer", "reason": "individual" }`; the suggestion text isn't scored.

### 6.3 The 15 cases

Filter lists not shown are empty.

| # | Question | Expected | What it checks |
| --- | --- | --- | --- |
| q01 | What is the median pay for a Senior Engineer in India? | median, none, countries IN, jobTitles Software Engineer, levels L3 | Persona question; "Senior" to L3; "Engineer" to a title |
| q02 | How does total payroll split by country? | total, groupBy country | "payroll" to total; "split by" to groupBy |
| q03 | How many people work in Sales? | headcount, none, departments Sales | Department word |
| q04 | Average salary by level for Product Managers in the US | average, groupBy level, countries US, jobTitles Product Manager | Group plus two filters |
| q05 | How many employees are paid outside their band in Germany? | outsideBandCount, none, countries DE | Band metric |
| q06 | What's the gender pay gap for Account Executives by level? | genderGap, groupBy level, jobTitles Account Executive | Gap metric with groupBy |
| q07 | Show me the 75th percentile salary for Data Analysts in the UK | p75, none, countries GB, jobTitles Data Analyst | "UK" to GB; percentile |
| q08 | Who is the highest paid engineer in Canada? | cannot_answer, individual | "Who" singles out a person even without a name |
| q09 | What is the highest salary for a Lead Software Engineer in Canada? | max, none, countries CA, jobTitles Software Engineer, levels L4 | Same words as q08, but answerable |
| q10 | How has median pay in India changed since last year? | cannot_answer, trend | Time question |
| q11 | Give Priya Nair a 5% raise | cannot_answer, edit | Write request |
| q12 | What's the min and max salary in Marketing? | cannot_answer, multiple | Two metrics |
| q13 | What do we spend on bonuses in the US? | cannot_answer, unsupported | Outside base salary |
| q14 | Headcount by gender in Engineering | headcount, groupBy gender, departments Engineering | "Engineering" is a department, unlike q01 |
| q15 | What is the typical salary of a junior support specialist in India and the UK? | median, none, countries IN and GB, jobTitles Support Specialist, levels L1 | "typical" to median; "junior" to L1; two countries |

### 6.4 Scoring and reporting

- Exact match after normalisation: enum values lower-cased, filter arrays sorted. For `cannot_answer`, the reason must match.
- `npm run eval` prints a table and writes `docs/evals/ask-eval-YYYY-MM-DD.md` with the model, prompt hash, each case's expected and actual result, a pass/fail column and the total. The report is committed.
- Bar: 13 of 15 before recording the demo. Each failure gets one line in the report saying whether the prompt, the schema or the expectation was wrong. A prompt change is followed by a new run and a new report, so the history shows each change and its effect.
- Cost: 15 calls at about $0.0003 each.

## 7. CI (details in 06)

Order: lint and typecheck, `npm run test:coverage`, build, `npm run e2e`. The coverage report is uploaded as a CI artifact. CI runs on pull requests and on `main` only, so red commits on slice branches never run it (06, D-058).

## 8. Acceptance criteria for this file

- [ ] Every feature F1 to F8, the seed and the cross-cutting concerns has a test list, each line one behaviour at a named level.
- [ ] Every 422 code and every role restriction in 04 has at least one integration test.
- [ ] Tooling and versions are decided, with the Vitest 5 amendment stated.
- [ ] Determinism rules cover clock, randomness, time zone, network and timers, each with an enforcement mechanism.
- [ ] The fake interpreter and a 15-question eval set with expected structured queries are defined, with scoring and a pass bar.
- [ ] The one E2E test's steps and setup are listed.
- [ ] "What we don't test" is explicit.

## 9. Out of scope, and why

- **Mutation testing (Stryker).** Strong evidence of test quality, but a long run on every change. Worth adding after v1 for `domain/`.
- **Visual regression tests.** UI polish is first on the cut list; pixel diffs would slow every UI change.
- **Load testing.** Chat 8 measures query times at 10k rows with a script; concurrency isn't a v1 concern with a handful of reviewers.
- **Cross-browser E2E.** Chromium only. The app uses no browser-specific APIs.
- **Accessibility automation (axe).** Component tests query by role and label, which catches most labelling gaps. A full axe pass is a later addition.
- **Running evals in CI.** D-053.
- **Property-based tests (fast-check).** Table-driven cases with Excel-checked values cover the money and percentile rules. Property tests would be the next step for `percentiles.ts`.

## 10. Open questions

| # | Question | Default until answered | Owner |
| --- | --- | --- | --- |
| 1 | Does the published `@libsql/client` version keep in-memory pools at one connection, as the current source does? | The guard test (5.0) answers it at S0; fallback is a shared-cache memory URL per test | S0 |
| 2 | Do MSW's Node interceptors and jsdom's globals work together with our versions? | One canary component test at S0 | S0 |
| 3 | Does Vitest 5 run cleanly with the pinned Vite and Testing Library versions? | Yes; fallback is Vitest 4.1 (D-055) | S0 |
| 4 | Pass bar of 13 of 15: right level? | Keep; revisit only if a failure is in a question type the demo uses | Chat 9 |

## Sources

- Vitest 5.0 announcement (released 3 Sep 2026; requires Vite 6.4+ and Node 22.12+; inline projects inherit root config; `clearMocks` on by default): https://vitest.dev/blog/vitest-5
- Vitest coverage config (glob-keyed thresholds, `perFile`, v8 provider): https://vitest.dev/config/coverage
- libSQL TypeScript client source (in-memory databases limited to a one-connection pool; transactions own their connection until settled): https://github.com/tursodatabase/libsql-client-ts/blob/main/packages/libsql-client/src/sqlite3.ts
- libSQL TypeScript reference (`:memory:` client, interactive transaction 5-second write lock, transaction modes): https://docs.turso.tech/sdk/ts/reference
- Mantine Vitest guide (jsdom, Testing Library packages, setup mocks, `MantineProvider` render wrapper): https://mantine.dev/guides/vitest/
- MSW quick start (`setupServer` from `msw/node`, `http` and `HttpResponse`, listen, reset and close lifecycle): https://mswjs.io/docs/quick-start
- Playwright web server config (`command`, `url`, `reuseExistingServer`): https://playwright.dev/docs/test-webserver

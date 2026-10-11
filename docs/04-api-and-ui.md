# 04 API and UI spec

Chat 4 output. The contract Claude Code builds against: every endpoint, the "Ask about pay" structured query, and every screen with its states.
Inputs: `decisions.md` (D-001 to D-038), `01-requirements.md` (F1 to F8), `02-data-model.md`, `03-architecture.md`, ADRs 0001 to 0008.
Goes into the repo as `docs/04-api-and-ui.md`. Where this file and an earlier doc disagree, section 2 lists the change; nothing else here contradicts a logged decision.

## 1. Decisions this file settles (proposed; logged in decisions.md at the end of Chat 6)

| ID | Decision | Why | Rejected alternatives |
| --- | --- | --- | --- |
| D-039 | Lists use offset paging: `page` (from 1) and `pageSize` (25, 50 or 100; default 50), with `total` and `totalPages` in every response. Multi-value filters are comma-separated in one param (`country=IN,US`). Unknown query params are rejected with 400 | At 10,000 rows the deepest page is page 400 at size 25, and the default name order walks index I2, so offset cost is small. HR wants "page 12 of 49" and a total count, which keyset paging can't give without a second query anyway. Comma lists keep shared URLs short. Rejecting unknown params catches UI bugs early | Keyset (cursor) paging: no page jumps, no total. Client-side paging: ships 10k salaries to the browser (H3). Repeated params (`country=IN&country=US`): longer URLs, two parsing paths |
| D-040 | One aggregation engine: a pure domain function `aggregatePay(rows, metrics, groupBy, minGroupSize)` serves the insights screens and "Ask about pay". The repository loads the active-employee projection once per request; the Finance minimum group size is applied inside the engine | One tested implementation of every metric. Ask can never return a number the screens would compute differently, and the Finance rule lives in one place | Separate SQL per screen plus separate code for Ask (two implementations to keep equal) |
| D-041 | "Who is paid outside their band" and "whose salary hasn't changed in two years" are answered by the employee list with filters (`band=outside`, `salaryUnchangedSince=<date>`). Insights endpoints return counts only and link to the filtered list | No second list endpoint with its own paging, sorting and export. The filtered list can be exported to CSV as it stands. Finance gets the counts and no list, which matches D-012 | Dedicated outside-band and stale-salary list endpoints |
| D-042 | The Ask structured query has every field required: `metric` (one of 10), `groupBy` (`none` or one of 5 dimensions), and `filters` with five arrays where an empty array means no filter. Filter values are names (countries as ISO codes, levels as `L1` to `L5`). Our code writes every answer sentence from templates (section 7.6) | Fits the strict-tool limits (no optional or union parameters, and arrays only support `minItems` 0 or 1). Names are what the model reads in the question. Templates keep numbers out of the model | Optional fields (count toward the 24-optional limit and invite omissions). Nullable fields (union types). IDs as filter values (the model would have to learn our IDs) |
| D-043 | Check order on every request: 401 not logged in, 403 role not allowed, 415 wrong content type, 400 invalid input, 404 not found, 422 business rule. The role check runs in an `onRequest` hook so it happens before body parsing and validation | A Finance user probing a write endpoint learns nothing about its schema. Fastify validates before `preHandler`, so a `preHandler` guard would leak 400s first | Role check in `preHandler` (as 03 section 6.3 said); role check inside services |
| D-044 | CSV export: RFC 4180 with CRLF line endings, UTF-8 with a byte-order mark, amounts as plain decimals in major units, and every text cell that starts with `=`, `+`, `-`, `@`, tab or carriage return prefixed with a tab inside its quotes (OWASP's Excel-safe guard). Name fields also reject those leading characters on input | HR opens exports in Excel; the BOM keeps non-ASCII names readable, and plain decimals stay numeric. Formula injection is a real risk for any exported free text; input validation plus output escaping covers both new and existing data | Single-quote prefix (OWASP notes Excel can drop it on save and re-open). No escaping (a name like `=HYPERLINK(...)` would run in Excel) |
| D-045 | The web API client detects a sleeping server: a request pending over 4 seconds, a non-JSON response to an `/api` call, a 502, 503 or 504 without a problem body, or a network error. It shows a "waking the server" banner, polls `GET /api/health` every 3 seconds for up to 90 seconds, then retries GETs once. Writes are never retried automatically | ADR 0002 removed the waking state for the first visit, since Render's own loading page covers it. A tab left open for more than 15 minutes still hits a sleeping server on its next call, and Render's docs only describe the browser loading page, not what a `fetch` receives. Handling every case keeps the client correct whichever one Render produces. Retrying a write could save it twice | No waking state at all (a 60-second hang with no feedback). Auto-retrying writes (possible double salary change) |
| D-046 | HR Admin and HR Viewer land on `/employees`; Finance lands on `/insights`. `/api/auth/me` returns the user, their allowed actions, `askEnabled` and the server's `today`. The web app gates UI on that action list and never keeps its own copy of the role table | Each role starts where its first question is answered. One permissions source (D-002). The server's date avoids a user ahead of UTC defaulting a salary change to "tomorrow" and getting a 422 | Shared permissions table imported by the web app (a second consumer of a security rule); client-side `new Date()` for defaults |
| D-047 | The pay-equity cohort table is visible to all three roles. A cohort shows numbers only when it has at least 5 women and 5 men, for every role; other cohorts show "too few to compare" with no counts | Every number shown is an aggregate over at least 10 people, so Finance can see it under D-012. One rule for every role is simpler to test than two | Pay equity for HR roles only (Finance has a legitimate pay-gap reporting interest); showing cohort counts below the threshold (reveals small groups) |

## 2. Changes this file makes to earlier docs

| Doc | Change | Reason |
| --- | --- | --- |
| `03-architecture.md` 6.3, ADR 0004 | `requires(action)` is an `onRequest` hook, not a `preHandler` | D-043 |
| `03-architecture.md` 6.6 | Status codes gain 415 (`UNSUPPORTED_MEDIA_TYPE`) | Write endpoints accept JSON only (ADR 0006 CSRF rule); Fastify answers other content types with 415 |
| `03-architecture.md` 5 | `api/src/domain/pay-query.ts` (the D-040 engine) and `web/src/components/ServerStatusBanner.tsx` (D-045) added. Insights pages are `InsightsPage`, `PayEquityPage`, `AskPage` | Placement for new modules |
| ADR 0002, Consequences | "The waking the server UI state isn't needed" becomes "isn't needed for the first visit; still needed when a tab outlives the 15-minute idle window (D-045)" | D-045 |
| `01-requirements.md` F2 | Search by employee ID is an exact match on the code, typed with or without the `E` and leading zeros (`4217`, `E4217`, `E004217`) | Exact match uses the unique index; prefix search on IDs has no user need |
| `01-requirements.md` F5 | The outside-band list is the employee list with `band=outside` | D-041 |

## 3. Where each user question is answered

| Question (from 01) | Role | Answered by |
| --- | --- | --- |
| Find an employee and record a raise | HR Admin | `/employees` search, then detail page, "Record salary change" (E1, E2, S2) |
| Who is paid outside their band? | HR roles | Insights card, then `/employees?band=outside` (I1, E1) |
| Whose salary hasn't changed in 2 years? | HR roles | Insights card, then `/employees?salaryUnchangedSince=<today minus 2 years>` (I1, E1) |
| Are women paid less than men in the same role? | All | `/insights/pay-equity` (I3) |
| Median pay for a Senior Engineer in India? | All | `/insights?groupBy=level&country=IN&jobTitle=1`, or Ask (I2, K1) |
| Export this filtered list for a review | HR roles | "Export CSV" on `/employees` (X1) |
| Total payroll by country in one currency? | All | `/insights` payroll by country, USD (I1) |
| Average and median pay by department and level? | All | `/insights?groupBy=department` or `groupBy=level` (I2) |

## 4. API conventions

### 4.1 Basics

- Every endpoint is under `/api`. JSON in and out, `camelCase` keys, UTF-8.
- Write endpoints (`POST`, `PATCH`) require `Content-Type: application/json`; anything else is 415.
- No API versioning prefix (03 section 12).
- Fastify trusts only the immediate peer, Render's proxy (`trustProxy: (_address, hop) => hop === 0`), so `request.ip` is the client address Render appends to `X-Forwarded-For` (used by the login rate limit). `trustProxy: true` would take the left-most entry, which the client controls, and let it get round the limit; Fastify 5 ignores a numeric hop count. Changed in S2 after review. Confirm with a log line on the live service in S9 (`08` §5).
- Responses to authenticated endpoints carry `Cache-Control: no-store` (salary data must not sit in shared or disk caches).

### 4.2 Value formats

| Value | JSON shape | Rule |
| --- | --- | --- |
| Money | `{ "amountMinor": 198000000, "currency": "INR" }` | Integer minor units plus ISO 4217 code, never one without the other (02 section 4). Annual gross base salary |
| USD conversion | Same Money shape with `currency: "USD"` | `toUsdMinor` per employee, half up (D-023) |
| Date | `"2026-10-09"` | `YYYY-MM-DD`, no time zone |
| Timestamp | `"2026-10-09T09:15:00.000Z"` | ISO 8601 UTC |
| Percentage | `4.0` | Number rounded to 1 decimal, half away from zero, by `packages/shared/src/percent.ts` (8.4.1). Never `-0`: a value that rounds to zero is sent as `0`. `null` where undefined (the hire row's change, a not-comparable gap). Positive means an increase (salary change) or women paid less (gender gap) |
| Compa-ratio | `0.97` | Number rounded to 2 decimals, half away from zero, from integers by `compaRatio(salaryMinor, midMinor)` in `packages/shared/src/percent.ts` (8.4.1). Never null |
| Enum values | `"female"`, `"market_adjustment"`, `"hr_admin"` | Exactly the DB values from 02 section 3 |
| Reference objects | `{ "code": "IN", "name": "India" }`, `{ "id": 1, "name": "Software Engineer" }` | Lists and details embed names so the web app never joins reference data itself |

### 4.3 Request pipeline (D-043)

In Fastify hook order:
1. `onRequest` auth hook: reads cookie `sid`, hashes it, loads the session and user (one primary-key lookup). Sets `request.viewer` to `{ id, role, displayName }` or `null`. An expired session row is treated as missing.
2. `onRequest` guard `requires(action)`, declared per route: `401 UNAUTHENTICATED` if `viewer` is null, `403 FORBIDDEN` if the role lacks the action. Public routes declare `requires('public')`, which always passes.
3. Rate limit (login only), `onRequest`.
4. Body parsing: 415 for a non-JSON body on a write route.
5. zod validation of params, query and body: 400 `VALIDATION_FAILED`.
6. Handler calls one service function. The service throws `NotFoundError` (404) or `RuleViolation` (422); the error handler maps both.

### 4.4 Errors (RFC 9457 problem details)

Every non-2xx response has `Content-Type: application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Unprocessable Content",
  "status": 422,
  "detail": "The effective date must be on or after the current salary's date (2026-04-01).",
  "code": "SALARY_DATE_BEFORE_CURRENT",
  "instance": "/api/employees/4217/salary-changes"
}
```

- `type` is always `about:blank`, so `title` is the HTTP status phrase. `code` is the stable machine-readable identifier the web app switches on. `detail` is a human sentence safe to show to the user; it never contains a salary of another employee, a stack trace or SQL.
- Validation errors add `errors`, one entry per failing field, with `path` joined by dots:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "2 fields are invalid.",
  "code": "VALIDATION_FAILED",
  "instance": "/api/employees",
  "errors": [
    { "path": "firstName", "message": "First name can't start with =, +, -, @ or a tab." },
    { "path": "startingSalary.amountMinor", "message": "Must be a whole number greater than 0." }
  ]
}
```

- 429 responses carry a `Retry-After` header in seconds.

Error code catalogue (complete; a new code needs a line here first):

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | zod rejected params, query or body, including unknown keys and unknown query params |
| 401 | `UNAUTHENTICATED` | No valid session |
| 401 | `INVALID_CREDENTIALS` | Login with wrong email or password (same message for both) |
| 403 | `FORBIDDEN` | Role lacks the route's action |
| 404 | `EMPLOYEE_NOT_FOUND` | No employee with that id |
| 404 | `PAY_BAND_NOT_FOUND` | R2 for a combination with no band |
| 404 | `ROUTE_NOT_FOUND` | Unknown `/api/*` path (never the SPA fallback) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Write without a JSON body |
| 422 | `NO_PAY_BAND` | Create, or salary change to a position, with no band for country, title and level |
| 422 | `SALARY_CURRENCY_MISMATCH` | Amount currency differs from the employee's country currency |
| 422 | `SALARY_DATE_BEFORE_CURRENT` | Effective date before the current salary's effective date |
| 422 | `DATE_IN_FUTURE` | Hire, termination or salary effective date after the server's today |
| 422 | `RAISE_REQUIRED` | `merit`, `market_adjustment` or `promotion` with an amount not above the current amount |
| 422 | `POSITION_MUST_NOT_CHANGE` | `merit` or `market_adjustment` with a different title or level |
| 422 | `PROMOTION_LEVEL_NOT_HIGHER` | `promotion` whose new level rank is not above the current rank |
| 422 | `CORRECTION_NO_CHANGE` | `correction` with the same amount, title and level as now |
| 422 | `EMPLOYEE_TERMINATED` | Salary change on a terminated employee |
| 422 | `EMPLOYEE_ALREADY_TERMINATED` | Terminating a terminated employee |
| 422 | `TERMINATION_BEFORE_HIRE` | Termination date before hire date |
| 429 | `RATE_LIMITED` | More than 10 login attempts per minute from one IP |
| 429 | `ASK_LIMIT_REACHED` | Per-user or global daily Ask cap reached |
| 503 | `ASK_UNAVAILABLE` | No API key for the configured `ASK_PROVIDER` (`GEMINI_API_KEY` or `ANTHROPIC_API_KEY`) |
| 503 | `ASK_UPSTREAM_FAILED` | Model call failed, timed out, refused, hit `max_tokens`, or returned input our schema rejects |
| 503 | `DB_UNAVAILABLE` | Health check could not run `SELECT 1` |
| 500 | `INTERNAL` | Anything unexpected; `detail` is a generic sentence, the error is logged with the request id |

### 4.5 Permissions (D-002, D-012)

`domain/permissions.ts` holds exactly this table. `/api/auth/me` returns the viewer's row as `permissions`.

| Action | HR Admin | HR Viewer | Finance | Used by |
| --- | --- | --- | --- | --- |
| `reference.read` | yes | yes | yes | R1, R2 |
| `employee.read` | yes | yes | no | E1, E2 |
| `employee.write` | yes | no | no | E3, E4, E5 |
| `salary.read` | yes | yes | no | S1 |
| `salary.write` | yes | no | no | S2 |
| `export.employees` | yes | yes | no | X1 |
| `insights.read` | yes | yes | yes | I1, I2, I3 |
| `ask.use` | yes | yes | yes | K1 |

`aggregateMinGroupSize(role)`: `finance` is 5, the HR roles are 1. Used by the engine (section 6).

### 4.6 Query parameter encoding

- Multi-value filters: one param, comma-separated, no spaces: `country=IN,US&level=L3,L4`. Empty values are dropped (`country=` means no filter). Duplicates are removed. Values are validated against the reference data (unknown value is 400 with the path, for example `country[1]`).
- Booleans: `true` or `false` only.
- The shared zod schema parses the query string; the web app builds URLs with the same schema's serializer, so a URL the UI writes is always one the API accepts.

### 4.7 Shared schema names (`packages/shared/src/schemas/`)

| File | Exports |
| --- | --- |
| `common.ts` | `Money`, `IsoDate`, `CountryCode`, `LevelCode`, `Gender`, `Role`, `PersonName` (trimmed, 1 to 100 chars, no leading formula character) |
| `problem.ts` | `Problem`, `ErrorCode` (enum of section 4.4) |
| `auth.ts` | `LoginBody`, `MeResponse`, `Action` |
| `reference.ts` | `ReferenceResponse`, `PayBandResponse` |
| `employee.ts` | `EmployeeListQuery`, `EmployeeListItem`, `EmployeeListResponse`, `EmployeeDetail`, `CreateEmployeeBody`, `UpdateEmployeeBody`, `TerminateBody`, `EmployeeExportQuery` |
| `salary.ts` | `SalaryChangeReason` (the 4 UI reasons), `SalaryChangeBody`, `SalaryChangeItem`, `SalaryHistoryResponse` |
| `insights.ts` | `Dimension`, `Metric`, `PayFilters`, `SummaryResponse`, `PayDistributionQuery`, `PayDistributionResponse`, `PayEquityQuery`, `PayEquityResponse` |
| `structured-query.ts` | `StructuredQuery`, `CannotAnswer` (section 7.2) |
| `ask.ts` | `AskBody`, `AskResponse` |

## 5. Endpoints

### 5.0 Index

| ID | Method and path | Action | Success |
| --- | --- | --- | --- |
| A1 | `GET /api/health` | public | 200 |
| A2 | `POST /api/auth/login` | public | 200 |
| A3 | `POST /api/auth/logout` | public | 204 |
| A4 | `GET /api/auth/me` | any logged-in user | 200 |
| R1 | `GET /api/reference` | `reference.read` | 200 |
| R2 | `GET /api/pay-bands/:countryCode/:jobTitleId/:levelCode` | `reference.read` | 200 |
| E1 | `GET /api/employees` | `employee.read` | 200 |
| E2 | `GET /api/employees/:id` | `employee.read` | 200 |
| E3 | `POST /api/employees` | `employee.write` | 201 |
| E4 | `PATCH /api/employees/:id` | `employee.write` | 200 |
| E5 | `POST /api/employees/:id/termination` | `employee.write` | 200 |
| S1 | `GET /api/employees/:id/salary-changes` | `salary.read` | 200 |
| S2 | `POST /api/employees/:id/salary-changes` | `salary.write` | 201 |
| I1 | `GET /api/insights/summary` | `insights.read` | 200 |
| I2 | `GET /api/insights/pay-distribution` | `insights.read` | 200 |
| I3 | `GET /api/insights/pay-equity` | `insights.read` | 200 |
| X1 | `GET /api/exports/employees.csv` | `export.employees` | 200 |
| K1 | `POST /api/ask` | `ask.use` | 200 |

Anything else under `/api` is `404 ROUTE_NOT_FOUND`. Any other path serves the web app (section 8.1).

### 5.1 A1 Health

`GET /api/health`, no auth. Runs `SELECT 1`.
- 200 `{ "status": "ok" }`
- 503 `DB_UNAVAILABLE` problem.
Used by the waking logic (D-045) and Render's health check.

### 5.2 Auth

**A2 `POST /api/auth/login`**

Body (`LoginBody`): `email` (trimmed, lower-cased, valid email, max 254), `password` (1 to 200 chars).

```json
{ "email": "hr.admin@acme.test", "password": "<from DEMO_HR_ADMIN_PASSWORD>" }
```

200: same body as A4. Sets cookie `sid` (ADR 0006: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production, `Max-Age=28800`).
Errors: 400 `VALIDATION_FAILED`; 401 `INVALID_CREDENTIALS` with detail "Email or password is incorrect." for both unknown email and wrong password (the hash comparison runs against a fixed dummy hash when the email is unknown, so timing doesn't reveal which); 429 `RATE_LIMITED` after 10 attempts per minute per IP, with `Retry-After`.

**A3 `POST /api/auth/logout`**

No body required (an empty JSON body `{}` is accepted). Deletes the session row if the cookie maps to one, clears the cookie. Always 204, including with no session.

**A4 `GET /api/auth/me`**

```json
{
  "user": { "id": 1, "email": "hr.admin@acme.test", "displayName": "HR Admin (demo)", "role": "hr_admin" },
  "permissions": ["reference.read", "employee.read", "employee.write", "salary.read", "salary.write", "export.employees", "insights.read", "ask.use"],
  "askEnabled": true,
  "today": "2026-10-09",
  "fxAsOf": "2026-09-30"
}
```

`askEnabled` is true only when the configured provider's key is set (`GEMINI_API_KEY` or `ANTHROPIC_API_KEY`, ADR 0009) and the role has `ask.use`. `today` is the clock's UTC date. 401 `UNAUTHENTICATED` without a session.

### 5.3 Reference data

**R1 `GET /api/reference`**

Everything the filters, forms and Ask labels need, in one call. Static in v1, so the web app caches it for the session.

```json
{
  "countries": [{ "code": "CA", "name": "Canada", "currency": "CAD" }, { "code": "IN", "name": "India", "currency": "INR" }],
  "departments": [{ "id": 1, "name": "Engineering" }],
  "jobTitles": [{ "id": 1, "name": "Software Engineer", "departmentId": 1 }],
  "levels": [{ "code": "L1", "name": "Associate", "rank": 1 }, { "code": "L3", "name": "Senior", "rank": 3 }],
  "genders": [{ "code": "female", "name": "Female" }, { "code": "male", "name": "Male" }, { "code": "non_binary", "name": "Non-binary" }, { "code": "not_disclosed", "name": "Not disclosed" }],
  "salaryChangeReasons": [{ "code": "promotion", "name": "Promotion" }, { "code": "merit", "name": "Merit increase" }, { "code": "market_adjustment", "name": "Market adjustment" }, { "code": "correction", "name": "Correction" }],
  "fx": { "asOfDate": "2026-09-30", "rates": [{ "currency": "INR", "usdPerUnit": "0.011500" }] }
}
```

Lists are sorted by name (levels by rank). `usdPerUnit` is a display string built from the micros; no client arithmetic uses it. Seeded IDs follow 02 section 7.3 table order (Engineering = 1, Software Engineer = 1, and so on); tests read IDs from reference data instead of hard-coding them.

**R2 `GET /api/pay-bands/:countryCode/:jobTitleId/:levelCode`**

Band preview for the add-employee and salary-change forms.

```json
{ "countryCode": "IN", "jobTitleId": 1, "levelCode": "L3",
  "min": { "amountMinor": 164000000, "currency": "INR" },
  "mid": { "amountMinor": 205000000, "currency": "INR" },
  "max": { "amountMinor": 246000000, "currency": "INR" } }
```

Errors: 400 for malformed params; 404 `PAY_BAND_NOT_FOUND`.

### 5.4 Employees

**E1 `GET /api/employees`** (`EmployeeListQuery`)

| Param | Type | Default | Rule |
| --- | --- | --- | --- |
| `page` | integer >= 1 | 1 | A page past the end returns `items: []` with the real `total` |
| `pageSize` | 25, 50, 100 | 50 | |
| `q` | string, trimmed, 1 to 100 chars | none | If it matches `^E?0*(\d{1,6})$` (case-insensitive), exact match on `employee_code = 'E' + zero-pad-6(digits)`. Otherwise normalise it as `name_search` is normalised (02 section 5) and match `instr(name_search, ?) > 0`. `instr` avoids LIKE wildcard escaping |
| `status` | `active`, `terminated`, `all` | `active` | |
| `country` | list of country codes | none | |
| `department` | list of department ids | none | Resolved to `job_title_id IN (...)` (I4) |
| `jobTitle` | list of job title ids | none | Combined with `department` by AND |
| `level` | list of level codes | none | |
| `gender` | list of gender codes | none | |
| `band` | `below`, `above`, `outside`, `inside` | none | Against the employee's own band: below is `salary_minor < min_minor`, above is `> max_minor`, outside is either, inside is neither (02 section 4) |
| `salaryUnchangedSince` | date | none | `salary_effective_date < ?` |
| `sort` | `name`, `salaryUsd`, `hireDate` | `name` | Name order is `last_name, first_name, id`. Every sort ends with `id` as a tie-breaker, so paging is stable |
| `order` | `asc`, `desc` | `asc` | |

All filters combine with AND. Values within one list combine with OR.

```json
{
  "items": [
    {
      "id": 4217,
      "employeeCode": "E004217",
      "firstName": "Priya",
      "lastName": "Nair",
      "gender": "female",
      "country": { "code": "IN", "name": "India" },
      "department": { "id": 1, "name": "Engineering" },
      "jobTitle": { "id": 1, "name": "Software Engineer" },
      "level": { "code": "L3", "name": "Senior" },
      "status": "active",
      "hireDate": "2021-07-12",
      "terminationDate": null,
      "salary": { "amountMinor": 198000000, "currency": "INR" },
      "salaryUsd": { "amountMinor": 2277000, "currency": "USD" },
      "salaryEffectiveDate": "2026-04-01",
      "compaRatio": 0.97,
      "bandPosition": "inside"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 280,
  "totalPages": 6,
  "fxAsOf": "2026-09-30"
}
```

Errors: 400 `VALIDATION_FAILED` (including unknown params). Performance budget (F2): under 300 ms for any page at 10k rows, measured in Chat 8.

**E2 `GET /api/employees/:id`** (`EmployeeDetail`)

The list item fields plus:

```json
{
  "band": {
    "min": { "amountMinor": 164000000, "currency": "INR" },
    "mid": { "amountMinor": 205000000, "currency": "INR" },
    "max": { "amountMinor": 246000000, "currency": "INR" }
  },
  "createdAt": "2026-09-30T00:00:00.000Z",
  "updatedAt": "2026-09-30T00:00:00.000Z"
}
```

Errors: 400 if `id` isn't a positive integer; 404 `EMPLOYEE_NOT_FOUND`.

**E3 `POST /api/employees`** (`CreateEmployeeBody`)

```json
{
  "firstName": "Arjun",
  "lastName": "Menon",
  "gender": "male",
  "countryCode": "IN",
  "jobTitleId": 1,
  "levelCode": "L2",
  "hireDate": "2026-10-05",
  "startingSalary": { "amountMinor": 160000000, "currency": "INR" }
}
```

Validation (400): every field required; names are `PersonName`; `hireDate` a valid date not before 1990-01-01; `amountMinor` an integer from 1 to 10^12; unknown keys rejected.
Rules (422, checked in this order): `DATE_IN_FUTURE` (hire date after today), `SALARY_CURRENCY_MISMATCH`, `NO_PAY_BAND`.
Effects, in one write transaction: assigns `employee_code` (E + zero-padded max id + 1), `status = 'active'`, `name_search`, current-salary columns from the starting salary with `salary_effective_date = hireDate`, and the first history row (reason `hire`, effective date = hire date, position = the given title and level, `changed_by_user_id` = viewer).
201 with header `Location: /api/employees/10251` and the `EmployeeDetail` body. Outside-band starting salaries are allowed (HR decides); the UI warns.

**E4 `PATCH /api/employees/:id`** (`UpdateEmployeeBody`)

Body: any non-empty subset of `firstName`, `lastName`, `gender`. The schema is strict, so `jobTitleId`, `levelCode`, `countryCode`, salary fields or any other key give 400 with that key in `errors` (D-029).

```json
{ "lastName": "Nair-Kumar" }
```

Allowed on terminated employees (record corrections). Updates `name_search` and `updated_at`. 200 with `EmployeeDetail`. Errors: 400, 404.

**E5 `POST /api/employees/:id/termination`** (`TerminateBody`)

```json
{ "terminationDate": "2026-10-09" }
```

Rules (422): `EMPLOYEE_ALREADY_TERMINATED`, `DATE_IN_FUTURE`, `TERMINATION_BEFORE_HIRE`. Sets `status`, `termination_date`, `updated_at`. 200 with `EmployeeDetail`. Termination can't be undone in v1 (section 10).

### 5.5 Salary history and changes

**S1 `GET /api/employees/:id/salary-changes`**

Newest first. Previous values are computed in TypeScript from the next-older row (D-025). Not paged: an employee has a few rows a year.

```json
{
  "items": [
    {
      "id": 41870,
      "effectiveDate": "2026-04-01",
      "reason": "merit",
      "amount": { "amountMinor": 198000000, "currency": "INR" },
      "previousAmount": { "amountMinor": 190000000, "currency": "INR" },
      "changePct": 4.2,
      "jobTitle": { "id": 1, "name": "Software Engineer" },
      "level": { "code": "L3", "name": "Senior" },
      "previousJobTitle": { "id": 1, "name": "Software Engineer" },
      "previousLevel": { "code": "L3", "name": "Senior" },
      "changedBy": null,
      "createdAt": "2026-04-01T00:00:00.000Z"
    },
    {
      "id": 41866,
      "effectiveDate": "2021-07-12",
      "reason": "hire",
      "amount": { "amountMinor": 150000000, "currency": "INR" },
      "previousAmount": null,
      "changePct": null,
      "jobTitle": { "id": 1, "name": "Software Engineer" },
      "level": { "code": "L2", "name": "Intermediate" },
      "previousJobTitle": null,
      "previousLevel": null,
      "changedBy": null,
      "createdAt": "2021-07-12T00:00:00.000Z"
    }
  ]
}
```

`changedBy` is `{ "displayName": "HR Admin (demo)" }` or `null` (seeded, shown as "Imported"). Rows with the same effective date are ordered by `id`. Errors: 404.

`changePct` is `changePct(previousAmountMinor, amountMinor)` from `packages/shared/src/percent.ts`: the change as a percentage of the previous amount, rounded per 8.4.1. It is `null` on the hire row. The salary-change form's preview (S-6) calls the same function, so the preview and the history row can't disagree.

**S2 `POST /api/employees/:id/salary-changes`** (`SalaryChangeBody`)

The position is always sent, even when unchanged, so the server never guesses.

```json
{
  "effectiveDate": "2026-10-09",
  "reason": "merit",
  "amount": { "amountMinor": 206000000, "currency": "INR" },
  "jobTitleId": 1,
  "levelCode": "L3"
}
```

Validation (400): all fields required; `reason` one of the 4 UI reasons (`hire` is rejected); `amountMinor` integer from 1 to 10^12.
Rules (422), checked in this order, all in `domain/salary-rules.ts` returning the first violation:
1. `EMPLOYEE_TERMINATED`
2. `DATE_IN_FUTURE` (effective date after today)
3. `SALARY_DATE_BEFORE_CURRENT` (before the current `salary_effective_date`; equal is allowed)
4. `SALARY_CURRENCY_MISMATCH`
5. Per reason (D-022):

| Reason | Amount | Title | Level | Code if broken |
| --- | --- | --- | --- | --- |
| `merit`, `market_adjustment` | > current | = current | = current | `RAISE_REQUIRED`, `POSITION_MUST_NOT_CHANGE` |
| `promotion` | > current | any | rank > current rank | `RAISE_REQUIRED`, `PROMOTION_LEVEL_NOT_HIGHER` |
| `correction` | any > 0 | any | any | `CORRECTION_NO_CHANGE` if amount, title and level all equal current |

6. `NO_PAY_BAND` if the new position has no band in the employee's country.

Effects, in one write transaction: insert the history row (`changed_by_user_id` = viewer, `created_at` from the clock), update `salary_minor`, `salary_effective_date`, `job_title_id`, `level_code`, `updated_at` on the employee (D-021, D-029).
201 with `Location` of the employee and body `{ "employee": EmployeeDetail, "change": SalaryChangeItem }`.

### 5.6 Insights (pre-aggregated; all over active employees only, D-016)

**I1 `GET /api/insights/summary`**, no params.

```json
{
  "fxAsOf": "2026-09-30",
  "headcount": 10000,
  "payrollUsd": { "amountMinor": 74512300000, "currency": "USD" },
  "byCountry": [
    {
      "country": { "code": "IN", "name": "India" },
      "headcount": 4000,
      "suppressed": false,
      "payrollLocal": { "amountMinor": 1081200000000, "currency": "INR" },
      "payrollUsd": { "amountMinor": 12433800000, "currency": "USD" }
    }
  ],
  "outsideBand": { "below": 281, "above": 279, "total": 560 },
  "staleSalaries": { "since": "2024-10-09", "count": 1102 }
}
```

(Figures illustrative.) `staleSalaries.since` is today minus 2 years (`date(today, '-2 years')` semantics, computed in TypeScript from the clock). The service loads the active projection once and calls the engine twice (ungrouped and by country) with metrics `headcount`, `total`, `outsideBandCount`. `byCountry` is sorted by country name. A suppressed group (Finance, under 5) has `headcount`, `payrollLocal` and `payrollUsd` set to `null`.

**I2 `GET /api/insights/pay-distribution`** (`PayDistributionQuery`)

| Param | Values | Default |
| --- | --- | --- |
| `groupBy` | `none`, `country`, `department`, `jobTitle`, `level`, `gender` | `country` |
| `country`, `department`, `jobTitle`, `level`, `gender` | lists, as E1 | none |

Metrics are fixed: headcount, min, P25, median, P75, max, average, total.

```json
{
  "fxAsOf": "2026-09-30",
  "groupBy": "level",
  "filters": { "countries": ["IN"], "departmentIds": [], "jobTitleIds": [1], "levelCodes": [], "genders": [] },
  "groups": [
    {
      "key": "L3",
      "label": "L3 Senior",
      "headcount": 280,
      "suppressed": false,
      "usd": {
        "min": { "amountMinor": 1610000, "currency": "USD" },
        "p25": { "amountMinor": 2270050, "currency": "USD" },
        "median": { "amountMinor": 2355200, "currency": "USD" },
        "p75": { "amountMinor": 2444700, "currency": "USD" },
        "max": { "amountMinor": 3220000, "currency": "USD" },
        "average": { "amountMinor": 2357340, "currency": "USD" },
        "total": { "amountMinor": 660055200, "currency": "USD" }
      },
      "local": {
        "min": { "amountMinor": 140000000, "currency": "INR" },
        "median": { "amountMinor": 204800000, "currency": "INR" }
      }
    }
  ]
}
```

(Abridged; `local` carries the same seven keys as `usd`.) `local` is present only when every employee in the group shares one currency, otherwise `null`. Groups with no employees are omitted. Group order: countries and departments and job titles by name, levels by rank, genders in reference order; `none` returns one group with `key: "all"`, `label: "All active employees"`. A suppressed group has `headcount`, `usd` and `local` set to `null`.

**I3 `GET /api/insights/pay-equity`** (`PayEquityQuery`)

| Param | Values | Default |
| --- | --- | --- |
| `country` | list of country codes | none |
| `department` | list of department ids | none |
| `flaggedOnly` | boolean | `false` |
| `includeNotComparable` | boolean | `false` |

Cohort = country + job title + level (D-013). Means are in the cohort's local currency.

```json
{
  "fxAsOf": "2026-09-30",
  "thresholdPct": 5,
  "minPerGender": 5,
  "org": {
    "meanGapPct": 11.4,
    "medianGapPct": 9.8,
    "women": 3410,
    "men": 6290,
    "basis": "usd"
  },
  "cohortCounts": { "withEmployees": 250, "comparable": 171, "flagged": 3 },
  "cohorts": [
    {
      "country": { "code": "IN", "name": "India" },
      "jobTitle": { "id": 1, "name": "Software Engineer" },
      "level": { "code": "L3", "name": "Senior" },
      "comparable": true,
      "women": 76,
      "men": 195,
      "meanWomen": { "amountMinor": 192280000, "currency": "INR" },
      "meanMen": { "amountMinor": 209000000, "currency": "INR" },
      "gapPct": 8.0,
      "flagged": true
    }
  ]
}
```

(Org and count figures illustrative.) Rules:
- `gapPct = (meanMen - meanWomen) / meanMen * 100`, flagged when the unrounded value is 5 or more (02 section 4). Non-binary and not-disclosed employees are counted in headcounts but not in either mean.
- A cohort with fewer than 5 women or fewer than 5 men has `comparable: false` and `women`, `men`, `meanWomen`, `meanMen`, `gapPct` all `null`, `flagged: false`, for every role (D-047).
- `org` uses every active woman and man in USD. Its counts are always far above 5.
- `cohortCounts` reflects the filters, before `flaggedOnly`.
- Order: comparable cohorts by `gapPct` descending, then not-comparable cohorts by country, title, level. Not-comparable cohorts appear only with `includeNotComparable=true`. Not paged (at most 250 rows).

### 5.7 X1 CSV export

`GET /api/exports/employees.csv` takes the E1 params except `page` and `pageSize` (`EmployeeExportQuery`), and returns every matching row (at most 10,250) in the E1 sort order.

Headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="employees-2026-10-09.csv"` (date from the clock), `Cache-Control: no-store`.

Columns, in order:

| Header | Value |
| --- | --- |
| Employee ID | `E004217` |
| First name, Last name | escaped as below |
| Gender | `Female` |
| Country | `India` |
| Department, Job title | names |
| Level | `L3 Senior` |
| Status | `Active` or `Terminated` |
| Hire date, Termination date | `YYYY-MM-DD`, empty if none |
| Salary | `1980000.00` (major units, 2 decimals, no grouping) |
| Currency | `INR` |
| Salary (USD) | `22770.00` |
| FX as of | `2026-09-30` |
| Compa-ratio | `0.97` |
| Band position | `Below`, `Inside` or `Above` |
| Salary effective date | `YYYY-MM-DD` |

Format (D-044): UTF-8 with BOM, CRLF, every field double-quoted with `"` doubled inside. Any text field starting with `=`, `+`, `-`, `@`, tab or carriage return gets a tab prepended inside the quotes. Built in memory by `modules/employees/csv.ts`, a pure function from rows to a string, unit-tested.

### 5.8 K1 Ask about pay

`POST /api/ask` (`AskBody`): `{ "question": "What is the median pay for a Senior Engineer in India?" }`. `question` is trimmed, 1 to 500 chars.

Flow (03 section 9, ADR 0008), in this order:
1. No API key: 503 `ASK_UNAVAILABLE`, detail "Ask about pay isn't set up on this server." No log row.
2. Caps: count today's (UTC) `ask_log` rows with outcome in `answered`, `cannot_answer`, `error`, for this user (30) and for everyone (300). Over either: write a `rate_limited` row, return 429 `ASK_LIMIT_REACHED` with `Retry-After` set to seconds until next UTC midnight and detail naming which cap ("You've used your 30 questions for today." or "The demo has reached today's question limit."). Concurrent requests may overshoot by a few; the provider-side $5 limit is the hard ceiling (D-037).
3. Call the interpreter (section 7). On timeout, API error, `stop_reason` of `refusal` or `max_tokens`, no tool call, or tool input that fails the zod parse: log `error`, return 503 `ASK_UPSTREAM_FAILED`, detail "Couldn't read that question right now. Try again, or rephrase it."
4. `cannot_answer` tool, or a semantic rule from 7.4 failing: log `cannot_answer`, return 200 with `kind: "cannot_answer"`.
5. `run_pay_query`: resolve names to IDs, run the engine as the viewer (Finance minimum group applies), render the template, log `answered` with the interpreted query JSON and token counts, return 200 with `kind: "answer"`.

Response `kind: "answer"`:

```json
{
  "kind": "answer",
  "question": "What is the median pay for a Senior Engineer in India?",
  "answer": "Median salary for Software Engineer, L3 Senior, India: INR 20,48,000 (USD 23,552), based on 280 active employees.",
  "interpretedQuery": {
    "metric": "median",
    "groupBy": "none",
    "filters": { "countries": ["IN"], "departments": [], "jobTitles": ["Software Engineer"], "levels": ["L3"], "genders": [] }
  },
  "interpretation": [
    { "label": "Metric", "value": "Median salary" },
    { "label": "Grouped by", "value": "Nothing" },
    { "label": "Country", "value": "India" },
    { "label": "Job title", "value": "Software Engineer" },
    { "label": "Level", "value": "L3 Senior" }
  ],
  "result": {
    "groupBy": "none",
    "rows": [
      {
        "key": "all",
        "label": "All matching employees",
        "headcount": 280,
        "suppressed": false,
        "value": {
          "type": "money",
          "usd": { "amountMinor": 2355200, "currency": "USD" },
          "local": { "amountMinor": 204800000, "currency": "INR" }
        }
      }
    ]
  },
  "fxAsOf": "2026-09-30",
  "usage": { "usedToday": 3, "dailyLimit": 30 }
}
```

`value` by metric:

| Metric | `value` |
| --- | --- |
| `headcount` | `{ "type": "count", "count": 280 }` |
| `total`, `average`, `median`, `p25`, `p75`, `min`, `max` | `{ "type": "money", "usd": Money, "local": Money or null }` |
| `outsideBandCount` | `{ "type": "outsideBand", "below": 12, "above": 9, "total": 21 }` |
| `genderGap` | `{ "type": "gap", "comparable": true, "gapPct": 8.0, "women": 76, "men": 195, "likeForLike": true }`; when not comparable, `gapPct`, `women`, `men` are `null` |

A suppressed row (Finance, group under 5) has `headcount: null` and `value: null`.

Response `kind: "cannot_answer"`:

```json
{
  "kind": "cannot_answer",
  "question": "What does Priya Nair earn?",
  "reason": "individual",
  "message": "Ask about pay answers questions about groups, not individual people. Use the employee list to look someone up.",
  "suggestion": "What is the median pay for Senior Software Engineers in India?",
  "examples": [
    "How does total payroll split by country?",
    "How many people are paid outside their band in the US?",
    "What is the gender pay gap for Account Executives by level?"
  ],
  "usage": { "usedToday": 4, "dailyLimit": 30 }
}
```

`message` comes from our template for `reason` (7.6); `suggestion` is the model's text, shown as plain text, at most 200 chars (longer is truncated); `examples` is a fixed list in code.

Errors: 400 (question length), 429 `ASK_LIMIT_REACHED`, 503 `ASK_UNAVAILABLE` or `ASK_UPSTREAM_FAILED`.

## 6. The pay aggregation engine (D-040)

`domain/pay-query.ts`, pure, no I/O.

```ts
type Dimension = 'country' | 'department' | 'jobTitle' | 'level' | 'gender';
type Metric = 'headcount' | 'total' | 'average' | 'median' | 'p25' | 'p75' | 'min' | 'max' | 'outsideBandCount' | 'genderGap';

interface PayRow {            // one active employee, loaded by insights/repo.ts
  countryCode: string; departmentId: number; jobTitleId: number; levelCode: string; gender: Gender;
  salaryMinor: number; currency: string; usdPerUnitMicros: number;
  bandMinMinor: number; bandMaxMinor: number; salaryEffectiveDate: string;
}

function aggregatePay(rows: PayRow[], metrics: Metric[], groupBy: Dimension | 'none', minGroupSize: number): GroupResult[];
```

Steps:
1. The repository applies filters in SQL (`status = 'active'` plus any filter lists) and returns `PayRow[]`, one query with joins to `job_titles`, `pay_bands` and `fx_rates`.
2. Group rows by the dimension (`none` is one group).
3. Per group: `headcount`; USD per row via `toUsdMinor`; `total` and `average` (half up to the cent) and percentiles (D-024) over USD values; the same in local currency when the group has one currency; `outsideBandCount` split below and above; `genderGap` per 02 section 4 with the 5-and-5 minimum, in local currency when single-currency, else USD.
4. If `headcount < minGroupSize`, return the group with `suppressed: true` and no values.
   Then, when `minGroupSize > 1` and exactly one group is suppressed, also suppress the smallest visible group, ties by key (D-071), so the hidden group can't be recovered from the total. A group hidden this way can have 5 or more people.
5. Sort groups as in I2.

`domain/pay-equity.ts` computes I3 from the same `PayRow[]`, so I2, I3 and Ask share one load path.
Expected load is at most 10,000 rows per request; Chat 8 measures it against Turso (section 11).

## 7. Ask about pay: interpreter contract

### 7.1 Request to the model (ADR 0008, ADR 0009)

> ADR 0009 adds `GeminiInterpreter` (the default provider). It sends one `generateContent` request: `systemInstruction` (7.3), one user message with the question, both tools as `functionDeclarations` (`parametersJsonSchema` from 7.2, no `strict`), `toolConfig.functionCallingConfig.mode: ANY`, `maxOutputTokens: 512`, 15-second timeout, no retries. A `finishReason` other than `STOP`, a blocked prompt, an HTTP error or no function call is an interpreter error (503 `ASK_UPSTREAM_FAILED`); function arguments are re-parsed as in 7.4. The rest of this section describes the Anthropic request.

`AnthropicInterpreter.interpret(question, context)` sends one Messages API request:
- `model`: `config.ASK_MODEL` (default `claude-haiku-5-5`), `max_tokens: 512`, 15-second timeout, SDK `maxRetries: 0`.
- `system`: the prompt in 7.3, with today's date filled in.
- `tools`: `run_pay_query` and `cannot_answer`, both `strict: true` (7.2).
- `tool_choice: { "type": "any" }`.
- `messages`: one user message containing only the question text.

The tool schemas are built once at startup from reference data. Reference data is static in v1, so the schema never changes between requests and the compiled grammar stays cached (Anthropic caches it for 24 hours after last use; changing the schema invalidates it).

### 7.2 Tool schemas (exact)

`run_pay_query` (enum lists shown for the seeded reference data; built from R1 at startup):

```json
{
  "name": "run_pay_query",
  "description": "Run one aggregate pay query over ACME's active employees. Use for any question about headcount, salary statistics, payroll, people paid outside their pay band, or the gender pay gap, for the whole company or a subset.",
  "strict": true,
  "input_schema": {
    "type": "object",
    "properties": {
      "metric": {
        "type": "string",
        "enum": ["headcount", "total", "average", "median", "p25", "p75", "min", "max", "outsideBandCount", "genderGap"],
        "description": "Exactly one statistic. Salaries are annual gross base pay."
      },
      "groupBy": {
        "type": "string",
        "enum": ["none", "country", "department", "jobTitle", "level", "gender"],
        "description": "Split the result by one dimension, or none for a single figure."
      },
      "filters": {
        "type": "object",
        "properties": {
          "countries": { "type": "array", "items": { "type": "string", "enum": ["CA", "DE", "GB", "IN", "US"] } },
          "departments": { "type": "array", "items": { "type": "string", "enum": ["Customer Support", "Engineering", "Finance", "Marketing", "Operations", "People", "Product", "Sales"] } },
          "jobTitles": { "type": "array", "items": { "type": "string", "enum": ["Account Executive", "Accountant", "Data Analyst", "HR Generalist", "Marketing Specialist", "Operations Analyst", "Product Designer", "Product Manager", "Software Engineer", "Support Specialist"] } },
          "levels": { "type": "array", "items": { "type": "string", "enum": ["L1", "L2", "L3", "L4", "L5"] } },
          "genders": { "type": "array", "items": { "type": "string", "enum": ["female", "male", "non_binary", "not_disclosed"] } }
        },
        "required": ["countries", "departments", "jobTitles", "levels", "genders"],
        "additionalProperties": false
      }
    },
    "required": ["metric", "groupBy", "filters"],
    "additionalProperties": false
  }
}
```

`cannot_answer`:

```json
{
  "name": "cannot_answer",
  "description": "Use when the question can't be answered with one aggregate pay query: it asks about a named person, a trend over time, a change to data, several statistics at once, pay outside base salary, or something unrelated or unclear.",
  "strict": true,
  "input_schema": {
    "type": "object",
    "properties": {
      "reason": { "type": "string", "enum": ["individual", "trend", "edit", "multiple", "unsupported", "unclear", "offTopic"] },
      "suggestion": { "type": "string", "description": "One answerable question close to what the user asked, in plain English." }
    },
    "required": ["reason", "suggestion"],
    "additionalProperties": false
  }
}
```

Both schemas use no optional parameters and no union types, so they sit well inside the strict limits (24 optional, 16 union parameters across all strict tools in a request). Arrays carry no `maxItems` (only `minItems` 0 or 1 is supported); the zod re-parse caps each array at the size of its reference list.

The zod schema `StructuredQuery` in `packages/shared` mirrors the `run_pay_query` input exactly; a unit test asserts the JSON Schema generated from the reference data and the zod schema accept and reject the same fixtures.

### 7.3 System prompt (draft; Chat 7 runs it through the prompt-clinic skill)

```
You translate HR questions about ACME's pay into exactly one tool call.
Today's date is {{today}}. All data is the current snapshot of active employees; there is no history.

Call run_pay_query when one statistic over a group of employees answers the question. Otherwise call cannot_answer.

Mapping rules:
- "pay", "salary", "compensation" mean annual gross base salary.
- "typical", "middle", "median" -> median. "average", "mean" -> average. "payroll", "total cost", "spend" -> total. "how many", "headcount" -> headcount. "lowest" -> min. "highest" -> max. "bottom quartile" -> p25. "top quartile" -> p75.
- "outside band", "below band", "above band", "underpaid against band" -> outsideBandCount (it reports below and above separately).
- "gender gap", "pay gap", "women vs men" -> genderGap. Never combine genderGap with a gender filter or groupBy gender.
- "by X", "per X", "split by X", "compare X" -> groupBy X. At most one groupBy.
- Levels: Associate, junior or entry = L1. Intermediate or mid = L2. Senior = L3. Lead = L4. Principal = L5.
- A role word (engineer, developer, accountant, designer, AE) is a job title: "engineer" or "developer" = Software Engineer; "AE" or "sales rep" = Account Executive. A team or function word (engineering, sales, finance team) is a department.
- Countries: India = IN, United States or US or America = US, United Kingdom or UK or Britain = GB, Germany = DE, Canada = CA.
- Only add a filter the question states. Leave every other filter list empty.

Use cannot_answer with:
- individual: the question names or singles out a person.
- trend: it asks about change over time, the past, or the future.
- edit: it asks to change, add or delete data.
- multiple: it asks for more than one statistic; suggest the most useful single one.
- unsupported: bonuses, equity, tax, net pay, or anything outside base salary.
- unclear or offTopic: anything else.
```

### 7.4 After the tool call

1. Parse the tool input with the shared zod schema. Enum values are matched case-insensitively and normalised to the canonical spelling (the API doesn't guarantee capitalisation of enum values). Failure: `ASK_UPSTREAM_FAILED`.
2. Semantic rules, which turn the query into `cannot_answer` with reason `unsupported` and our message:
   - `genderGap` with `groupBy: "gender"` or a non-empty `genders` filter.
3. Resolve names to IDs from reference data; build `PayFilters`.
4. Run `aggregatePay` with `[metric]` and, for money metrics, `headcount` too (the answer always states the base).

### 7.5 Fake interpreter (for every automated test)

`FakeInterpreter` takes a `Map<string, InterpretResult>` keyed by the exact question. An unknown question returns `{ kind: "cannot_answer", reason: "unclear", suggestion: "..." }`. A second constructor option makes it throw, to test `ASK_UPSTREAM_FAILED`. Chat 5 defines the eval set that runs the real interpreter outside the unit suite.

### 7.6 Answer templates (`modules/ask/answer.ts`, pure, unit-tested)

Sentence: `{metric phrase}{group phrase} for {scope}: {value}{base}.`

| Part | Rule |
| --- | --- |
| Metric phrase | headcount "Headcount", total "Total annual payroll", average "Average salary", median "Median salary", p25 "25th percentile salary", p75 "75th percentile salary", min "Lowest salary", max "Highest salary", outsideBandCount "Employees paid outside their band", genderGap "Gender pay gap" |
| Group phrase | Empty for `none`; otherwise " by country", " by department", " by job title", " by level", " by gender" |
| Scope | Filter labels in the order job titles, levels (`L3 Senior`), departments, genders, countries, joined by ", ". Several values in one filter join with " or ". No filters: "all active employees" |
| Value, ungrouped | Money: local formatted, then USD in brackets (`INR 20,48,000 (USD 23,552)`), or USD only if mixed currencies. Count: the number. Outside band: `21 (12 below, 9 above)`. Gap: `women paid 8.0% less than men`, `more than` if negative, or `no measurable gap (0.0%)` if it rounds to zero, then ` (like-for-like)` or ` (unadjusted: mixes roles and levels; see Pay equity for like-for-like cohorts)` |
| Value, grouped | Sentence ends with ":" and the result table carries the values |
| Base | Money and outside-band metrics: `, based on N active employees`. Headcount: nothing |
| Like-for-like | True when the filters pin exactly one country, one job title and one level and `groupBy` is `none` |
| Empty | `No active employees match {scope}.` |
| Suppressed (Finance) | `Some figures are hidden to protect groups of fewer than 5 employees.` |
| Gap not comparable | `Too few women or men in {scope} to compare (at least 5 of each needed).` |
| FX | Never in the sentence; the UI shows `FX as of` under the answer |

Cannot-answer messages by reason:

| Reason | Message |
| --- | --- |
| `individual` | Ask about pay answers questions about groups, not individual people. Use the employee list to look someone up. |
| `trend` | Ask about pay only knows current salaries, not changes over time. |
| `edit` | Ask about pay can't change data. Use the employee pages to make changes. |
| `multiple` | Ask about pay answers one figure at a time. Try asking for one. |
| `unsupported` | Ask about pay covers annual base salary only (no bonuses, equity, tax or net pay). The gender gap can't be filtered or grouped by gender. |
| `unclear`, `offTopic` | I couldn't turn that into a pay question. Try one of the examples below. |

(The `unsupported` row shows only the sentence that applies: the second sentence for the gender rule from 7.4, the first otherwise.)

## 8. UI

### 8.1 Shell, routes and landing pages

Fastify serves the web build with `@fastify/static` (`wildcard: false`) and a `setNotFoundHandler` that returns `404 ROUTE_NOT_FOUND` problem JSON for paths under `/api/` and `index.html` for everything else.

Layout: Mantine `AppShell` with a header (app name "ACME Salary Manager", nav links, user menu showing display name, a role badge and "Log out").

| Route | Screen | Needs action | Nav label |
| --- | --- | --- | --- |
| `/login` | Login | none | |
| `/employees` | Employee list | `employee.read` | Employees |
| `/employees/new` | Add employee | `employee.write` | (button on list) |
| `/employees/:id` | Employee detail with history | `employee.read` | |
| `/insights` | Pay insights | `insights.read` | Insights |
| `/insights/pay-equity` | Pay equity | `insights.read` | Pay equity |
| `/ask` | Ask about pay | `ask.use` and `askEnabled` | Ask about pay |
| `/` | Redirect to the role's landing page | | |
| any other | Not found page | | |

Landing page after login and for `/`:

| Role | Lands on | Sees in nav |
| --- | --- | --- |
| HR Admin | `/employees` | Employees, Insights, Pay equity, Ask about pay |
| HR Viewer | `/employees` | Employees, Insights, Pay equity, Ask about pay |
| Finance | `/insights` | Insights, Pay equity, Ask about pay |

"Ask about pay" is hidden from nav when `askEnabled` is false. Login honours `?next=` when the viewer may open that route; otherwise the landing page.

### 8.2 Global states

| State | Trigger | What the user sees |
| --- | --- | --- |
| Checking session | App start, `GET /api/auth/me` pending | Centered loader, no shell |
| Logged out | `me` returns 401 | Redirect to `/login?next=<current path>` |
| Session expired | Any later 401 | Query cache cleared, redirect to `/login?next=...` with notice "Your session expired. Log in again." |
| Forbidden route | Route needs an action the viewer lacks | In-shell page: "You don't have access to this page." plus a link to the landing page. No redirect, so the reason is visible |
| Waking (D-045) | See 8.3 | Yellow banner under the header: "Waking the server. Free hosting sleeps after 15 minutes without use; this can take up to a minute." Content stays visible |
| Server down | Waking lasted 90 seconds | Red banner: "The server isn't responding." with a "Try again" button that restarts the health poll |
| Offline | `navigator.onLine` false | Grey banner: "You're offline." |
| Unexpected error | Render error in a screen | Error boundary: "Something went wrong on this page." with "Reload" |

### 8.3 Data fetching rules

API client `api/client.ts`:
- Same-origin `fetch` with `credentials: 'same-origin'` and `Accept: application/json`.
- Successful JSON is parsed with the shared response schema in development builds (catches contract drift early) and trusted in production.
- A problem response becomes `ApiError { status, code, detail, errors }`.
- Waking detection (D-045): a 4-second timer on each request sets the connection store to `slow` (shows the waking banner). A network `TypeError`, a 502, 503 or 504 without `application/problem+json`, or any non-JSON response to an `/api` call raises `ServerWakingError` and sets the store to `waking`. The store then polls `GET /api/health` every 3 seconds; on a 200 JSON response it returns to `ok`, and GETs that failed are retried once. After 90 seconds it moves to `down`. A write that hit `ServerWakingError` is not retried; the form shows "The server was waking up, so your change may not have been saved. Check the page and try again."
- The connection store is a tiny external store read with `useSyncExternalStore` by `ServerStatusBanner`.

TanStack Query:
- Query keys: `['me']`, `['reference']`, `['employees', query]`, `['employee', id]`, `['salary-history', id]`, `['insights', 'summary']`, `['insights', 'distribution', query]`, `['insights', 'pay-equity', query]`.
- `staleTime`: reference and `me` infinite; everything else 30 seconds.
- `retry`: never for `ApiError` (4xx and 5xx with a problem body are final); the waking logic owns transport retries.
- Employee list uses `placeholderData: keepPreviousData` so the table stays visible while the next page loads.
- After a successful write, invalidate: E3 `['employees']`, `['insights']`; E4 `['employee', id]`, `['employees']`; E5 and S2 `['employee', id]`, `['salary-history', id]`, `['employees']`, `['insights']`.

URL state: list, insights and pay-equity filters live in search params via one hook per page (`useEmployeeFilters`, `useInsightsFilters`, `usePayEquityFilters`), parsed with the shared zod query schemas. Defaults are omitted from the URL. Changing any filter resets `page` to 1. Discrete filter changes push a history entry; search typing (debounced 300 ms) replaces it, so Back steps through real choices. An invalid URL value is dropped and the URL is rewritten without it, with a notice "Some filters in this link weren't recognised and were removed."

### 8.4 Formatting (`web/src/format.ts`, pure, unit-tested)

| Value | Format |
| --- | --- |
| Money in tables and cards | `Intl.NumberFormat` with `style: 'currency'`, `currencyDisplay: 'code'`, no fraction digits; locale `en-IN` for INR (lakh grouping), `en-US` otherwise. `INR 20,48,000`, `USD 23,552` |
| Money in forms | Major units with 2 decimals, converted to minor units on submit by string parsing (never floating-point multiply) |
| Dates | `Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })`: `9 Oct 2026`. Unambiguous across the five countries |
| Percentages and compa-ratio | See 8.4.1 |
| Level | `L3 Senior` |
| FX note | `FX as of 30 Sep 2026` under every view with converted figures |

#### 8.4.1 Percentages and ratios

`packages/shared/src/percent.ts` holds every percentage and ratio calculation. The API and the web both import it.

Calculation (API and web): integer arithmetic on minor units, rounded half away from zero, never returning `-0`.
- `changePct(prevMinor, nextMinor)`: tenths = (next - prev) * 1000 / prev, rounded on the integer remainder.
- `gapPct(meanMenMinor, meanWomenMinor)`: tenths = (men - women) * 1000 / men.
- `sharePct(partMinor, totalMinor)`: tenths = part * 1000 / total.
- `compaRatio(salaryMinor, midMinor)`: hundredths = salary * 100 / mid.
- Intermediates stay under `Number.MAX_SAFE_INTEGER` for amounts up to 10^12 minor units.
- `Math.round` is not used: it sends ties toward plus infinity (`-0.25` becomes `-0.2`), and floating-point division misrounds ties (`1.005` becomes `1.00`).

Display (web): `formatPct(value, { signed })` uses `Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'negative' })` plus `%`. Its default rounding (`halfExpand`) is also half away from zero, so an already-rounded API value is unchanged.

| Value | Where shown | Decimals | Positive | Negative | Rounds to zero, or exactly zero | Null |
| --- | --- | --- | --- | --- | --- | --- |
| Salary change % | S-3 history Change column; S-6 preview | 1 | `+4.2%` | `-1.0%` | `0.0%`, no sign | `n/a` (hire row) |
| Gender gap % | S-9 table and org cards | 1 | `8.0%` (women paid less) | `-1.2%` (women paid more) | `0.0%` | `Too few to compare` |
| Share of total USD | S-8 payroll by country | 1 | `40.0%` | not possible | `0.0%` | `n/a` (suppressed country) |
| Compa-ratio | S-2 tooltip, S-3, S-4 and S-6 previews, CSV | 2 | `0.97` | not possible | not possible | not possible |

Shares are computed in the web from `payrollUsd` with `sharePct` and may not add up to exactly 100.0%; that's expected.

In Ask answers (7.6), a gender gap that rounds to zero reads `no measurable gap (0.0%)` instead of `women paid 0.0% less than men`.

### 8.5 Screens

Each screen lists its content and its loading, empty and error states. "HR roles" means HR Admin and HR Viewer.

**S-1 Login (`/login`)**
- Email and password fields, "Log in" button. A box listing the three demo emails and their roles, with "Passwords are in the README."
- Loading: button shows a spinner and is disabled.
- Errors: `INVALID_CREDENTIALS` as an alert above the form; `RATE_LIMITED` as "Too many attempts. Try again in N seconds." using `Retry-After`; validation messages under fields.

**S-2 Employee list (`/employees`)** (HR roles)
- Filter bar: search box (placeholder "Search name or employee ID"); multi-selects Country, Department, Job title (options narrowed to the chosen departments), Level, Gender; selects Status (Active, Terminated, All), Pay band (Any, Below band, Above band, Outside band, Inside band); date input "No salary change since"; "Clear filters".
- Toolbar: "Showing 51 to 100 of 2,431 employees"; "Export CSV" (HR roles; downloads via the API client as a blob so waking and errors behave like other calls; button shows a spinner while fetching); "Add employee" (HR Admin only).
- Table columns: Employee ID, Name (sortable), Country, Job title, Level, Salary (local, with USD underneath in smaller text; sortable by USD), Band (badge: Below, Inside, Above with text, not color alone; compa-ratio in a tooltip), Hire date (sortable), Status badge for terminated rows. Clicking a row opens the detail page.
- Footer: Mantine `Pagination`, page size select (25, 50, 100), FX note.
- Loading: first load shows 10 skeleton rows; later loads keep the previous rows dimmed with a thin progress bar.
- Empty, no filters: "No employees yet." with "Add employee" for HR Admin. Empty, filtered: "No employees match these filters." with "Clear filters".
- Page out of range: "This page is past the end of the results." with "Go to last page".
- Error: inline alert with `detail` and "Retry".

**S-3 Employee detail (`/employees/:id`)** (HR roles)
- Header: name, employee ID, status badge, `Software Engineer, L3 Senior, India`, hire date. Terminated: a grey banner "Terminated on 9 Oct 2026. Excluded from current insights. History is kept."
- Current salary card: local amount, USD amount, effective date, band bar showing min, mid, max with a marker at the salary, compa-ratio, and "Below band" or "Above band" in text when outside.
- Details card: first name, last name, gender, country, department.
- Salary history table: Effective date, Reason, Amount, Change (`+4.2%`), Position (shows `L2 Intermediate to L3 Senior` when it changed, otherwise the position), Recorded by (`Imported` when null).
- Actions (HR Admin only): "Edit details" (always), "Record salary change" and "Terminate" (active employees only). HR Viewer sees no action buttons.
- Loading: skeleton cards. 404: "Employee not found." with a link back to the list. Error: alert with "Retry".

**S-4 Add employee (`/employees/new`)** (HR Admin)
- Fields: First name, Last name, Gender, Country (shows its currency next to the salary field), Job title, Level, Hire date (max = `today` from `me`), Starting salary.
- Band preview: when country, title and level are chosen, R2 loads and shows min, mid, max and the compa-ratio of the entered amount. Outside the band shows a yellow warning "This is below the band minimum." (or above) without blocking.
- Submit: client validation with the shared zod schema first, then the server. `errors[]` map to fields by `path`; 422 codes map per 8.6.
- Success: navigate to the new detail page with a toast "Employee E010251 added."
- Cancel returns to the list, keeping its URL filters.

**S-5 Edit details (modal from S-3)** (HR Admin)
- First name, Last name, Gender. Title, level and country are shown read-only with the note "Change title or level by recording a salary change."
- Save disabled until something changes. Success: toast "Details updated."

**S-6 Record salary change (modal from S-3)** (HR Admin, active employees)
- Reason (Promotion, Merit increase, Market adjustment, Correction). Effective date (default and max `today` from `me`, min the current salary's effective date). New annual salary (currency fixed to the employee's). Job title and Level.
- Field behaviour by reason: Merit and Market adjustment lock title and level to current. Promotion offers only higher levels, title editable. Correction leaves everything editable.
- Live preview under the form: current to new amount, change %, new compa-ratio and band position for the chosen position (R2).
- 422 codes map to fields per 8.6. `EMPLOYEE_TERMINATED` closes the modal and refreshes the page.
- Success: modal closes, toast "Salary change recorded.", history and salary card refresh.

**S-7 Terminate (modal from S-3)** (HR Admin)
- Termination date (default and max `today`, min hire date). Text: "Terminating removes {name} from current insights. Their record and salary history are kept. This can't be undone in this version." Red "Terminate" button.

**S-8 Insights (`/insights`)** (all roles)
- Summary cards: Active headcount; Annual payroll (USD); Paid outside band (`560`, with `281 below, 279 above`); No salary change since `9 Oct 2024`. For HR roles the last two cards link to `/employees?band=outside` and `/employees?salaryUnchangedSince=2024-10-09`; Finance sees the counts without links.
- Payroll by country: table (Country, Headcount, Payroll local, Payroll USD, share of total USD) and a horizontal bar chart of payroll USD.
- Pay distribution: segmented control "Group by" (Country, Department, Job title, Level, Gender) and filters Country, Department, Job title, Level, all in the URL. Table: Group, Headcount, Min, P25, Median, P75, Max, Average (USD; local shown underneath when the group has one currency). Bar chart of the median per group. Suppressed groups show "Hidden to protect small groups" across the row.
- FX note at the bottom.
- Loading: card and table skeletons. Empty (filters match no one): "No active employees match these filters." Error: alert per section with "Retry".

**S-9 Pay equity (`/insights/pay-equity`)** (all roles)
- Org cards: "Mean gap (unadjusted)" and "Median gap (unadjusted)", with the explanation "Compares all women with all men, across different roles and levels. Use the cohort table for like-for-like comparisons."
- Cohort counts line: "171 of 250 cohorts can be compared; 3 are flagged."
- Filters: Country, Department, "Flagged only" switch, "Show cohorts too small to compare" switch.
- Table: Country, Job title, Level, Women, Men, Mean (women), Mean (men), Gap, Status. Gap shows `8.0%`; Status shows a "Review" badge with an icon for flagged rows. Not-comparable rows show "Too few to compare" across the number columns.
- Footnote: "Flagged at a gap of 5% or more, the EU Pay Transparency Directive's joint pay assessment trigger. Cohorts need at least 5 women and 5 men. A flag is a signal to review, not a legal finding."
- Loading, empty ("No cohorts match these filters."), error as above.

**S-10 Ask about pay (`/ask`)** (all roles, when `askEnabled`)
- Question box (500-char counter), "Ask" button, three example questions as clickable chips.
- Usage line: "3 of 30 questions used today."
- Answer card: the answer sentence; a "How I read your question" panel listing `interpretation` as label and value pairs; for grouped results a table of rows; FX note.
- Cannot-answer card: the message, the suggestion as a clickable chip that fills the box, the examples.
- Earlier questions of this visit stay listed below, newest first (client memory only, lost on reload).
- Loading: "Reading your question..." with the button disabled.
- Errors: `ASK_LIMIT_REACHED` shows its detail and the reset time ("Resets at 05:30 your time", from `Retry-After`); `ASK_UPSTREAM_FAILED` shows its detail with "Try again"; `ASK_UNAVAILABLE` (or a direct visit when `askEnabled` is false) shows "Ask about pay isn't set up on this server. Everything else works without it."

**S-11 Not found and Forbidden** (any): plain in-shell pages with a link to the landing page.

### 8.6 Error code to UI mapping

| Code | Where it shows |
| --- | --- |
| `VALIDATION_FAILED` | Each `errors[]` entry under its field (path match); unmatched paths in a form alert |
| `NO_PAY_BAND` | Form alert: "There's no pay band for this country, job title and level." |
| `SALARY_CURRENCY_MISMATCH`, `RAISE_REQUIRED` | Amount field |
| `SALARY_DATE_BEFORE_CURRENT`, `DATE_IN_FUTURE` | Date field |
| `POSITION_MUST_NOT_CHANGE`, `PROMOTION_LEVEL_NOT_HIGHER` | Level field |
| `CORRECTION_NO_CHANGE` | Form alert |
| `EMPLOYEE_TERMINATED`, `EMPLOYEE_ALREADY_TERMINATED` | Close modal, refresh, toast with `detail` |
| `TERMINATION_BEFORE_HIRE` | Date field |
| `FORBIDDEN` | Forbidden page (route) or toast (action) |
| `EMPLOYEE_NOT_FOUND` | Not-found state on S-3 |
| `UNAUTHENTICATED` | Session-expired flow (8.2) |
| anything else | Alert with `detail` |

### 8.7 Accessibility and layout

- Every input has a visible label; errors are linked with `aria-describedby` (Mantine does this when `error` is set).
- Status is never color alone: band, flag and terminated badges carry text.
- Desktop first (min 1024 px wide for the full table); below that, tables scroll horizontally inside their container.
- Keyboard: table rows are links, modals trap focus, Escape closes them.

## 9. Acceptance criteria for this file

- [ ] Every endpoint has method, path, action, request and response examples, validation rules and error codes.
- [ ] Every error code used anywhere appears in the catalogue (4.4), and every 422 rule maps to a UI location (8.6).
- [ ] The permission table covers every route, and Finance can reach no endpoint that returns names or individual salaries.
- [ ] List paging, filtering and sorting params are fully specified, including defaults, combination rules and tie-breaks.
- [ ] Insights endpoints return pre-aggregated data, with the Finance minimum group size defined in one place.
- [ ] The structured-query schema is given as exact JSON Schema within the strict-tool limits, with its zod mirror and the behaviour without an API key.
- [ ] Every answer sentence and cannot-answer message comes from a template in 7.6.
- [ ] Every screen lists its content, role visibility, and loading, empty and error states; filters live in the URL; each role's landing page is stated; the waking state is specified.
- [ ] Nothing here contradicts `decisions.md`; changes to earlier docs are listed in section 2.

## 10. Out of scope, and why

- **Bulk salary changes (an annual merit cycle).** An HR manager at 10,000 people will want this, and it's the biggest gap in v1. It needs a preview, partial-failure handling and an approval step to be safe. v1 records changes one at a time; this is the first feature after v1.
- **Undoing a termination or deleting a salary change.** History is append-only (D-021); a mistaken salary is fixed with a `correction`. Rehiring is a new employee record.
- **Editing pay bands, FX rates or reference data.** Seeded and read-only (D-017, D-018).
- **User management screens.** Three seeded demo accounts (D-002).
- **Saved views and custom dashboards.** Filters in the URL can be bookmarked and shared, which covers saved views.
- **Ask: follow-up questions, multi-metric answers, history across visits.** Each question stands alone (D-015); earlier answers live only in the page.
- **Protection against differencing across overlapping aggregates.** Finance could, in principle, subtract two large groups to estimate a small one. The minimum group size blocks direct small-group figures only. A statistical disclosure-control method is expert work outside this build.
- **Optimistic locking on concurrent edits.** One HR Admin edits at a time in v1 (02 section 9).
- **Mobile layout beyond horizontal table scroll.** HR does this work at a desk.
- **Internationalised UI text.** English only.

## 11. Open questions

| # | Question | Default until answered | Owner |
| --- | --- | --- | --- |
| 1 | What does a `fetch` to `/api` receive while Render spins the service up: a held request, an HTML page, or a 5xx? | Client handles all three (D-045). Observe once in S9 (`08` §5) | Chat 8 / S9 |
| 2 | Does trusting only the proxy hop (4.1) give the real client IP on Render, so the login limit is per user rather than global? | Assumed yes; check logged `request.ip` in S9 (`08` §5) | Chat 8 / S9 |
| 3 | Do insights requests that load up to 10,000 rows from Turso stay fast enough (target under 500 ms)? | Measure in S10 per `08` §6. Fallback: in-process active-projection cache, cleared on every employee or salary write | Chat 8 / S10 |
| 4 | How long does the first Ask call take while the provider compiles or warms, and does it fit the 15-second timeout? | Measure on deploy in S10 per `08` §6 | Chat 8 / S10 |
| 5 | Should Finance get a CSV of aggregate tables? | No in v1 (01 open question, carried) | After v1 |

## Sources

- Render free web services (spin down after 15 minutes without traffic, up to a minute to spin up, a loading page shown to browsers): https://render.com/free
- Anthropic strict tool use (`strict: true`, schema-valid tool input): https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- Anthropic structured outputs: JSON Schema limits (`minItems` 0 or 1 only, no numeric or string constraints, `additionalProperties: false`), 24 optional and 16 union parameters across strict schemas, enum capitalisation caveat, `refusal` and `max_tokens` stop reasons, grammar cached 24 hours and invalidated by schema changes: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OWASP CSV Injection (formula characters; tab prefix inside quotes for Excel, single-quote prefix unreliable after save and re-open): https://owasp.org/www-community/attacks/CSV_Injection
- Turso SQLite compatibility (`instr`, `CASE`, `LIMIT`, date modifiers supported; `%` and aggregate `FILTER` unsupported): https://github.com/tursodatabase/turso/blob/main/COMPAT.md
- `@fastify/rate-limit` (`Retry-After` header, `errorResponseBuilder` for a custom 429 body): https://www.npmjs.com/package/@fastify/rate-limit
- `@fastify/static` with an SPA fallback through `setNotFoundHandler`: https://github.com/fastify/fastify-static
- RFC 9457 Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457

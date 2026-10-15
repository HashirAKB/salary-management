### Spec review: S2
Verdict: GAPS FOUND

| # | Kind | Where | Spec | Problem | Failing test that would prove it |
| --- | --- | --- | --- | --- | --- |
| 1 | Correctness | apps/api/src/modules/auth/routes.ts:1047 (diff line 1047) | 04 §5.2 A2 (400 `VALIDATION_FAILED`), 04 §4.3 step 5, 04 §4.4 | The login body is checked with `loginBodySchema.parse(request.body)` inside the handler, not through the route `schema`. The `ZodError` it throws is neither an `AppError` nor a Fastify schema-validation error, so `error-handler.ts` falls through to `500 INTERNAL` and logs it as an unexpected error. A malformed login, such as a missing password, a bad email or an empty body, gets a 500 instead of 400 with `errors[]`. | `it('returns 400 VALIDATION_FAILED with a password path when the login body has no password')` |
| 2 | Correctness | apps/web/src/features/auth/useSession.ts:21-25 (`useMe`), with the default `new QueryClient()` in apps/web/src/main.tsx | 04 §8.3 ("retry: never for ApiError"), 04 §8.2 (Logged out: `me` returns 401, so redirect) | `useMe` keeps TanStack's default of 3 retries with backoff, so in production a 401 from `me` is retried for about 7 s before `isError` sends the user to `/login`. A logged-out visitor sees the session loader for that long. The tests miss it because `test/render.tsx` turns retries off. | `it('redirects a logged-out visitor to /login after a single GET /api/auth/me')`, using the app's real query client options and counting `me` calls |

Checked:
- 05 §5.2: all U rows, including the existing `password.test.ts`; all I rows (login cookie, Secure in production, same 401 body, 429 with Retry-After, token hash stored, 8 h expiry, logout with and without a session, `me`, the four access-matrix tests); C rows 1 to 5. C row 6 (Ask nav) belongs to S8.
- 05 §5.0: the `Cache-Control` row and the log redaction row.
- 05 §5.9: the `ApiError` row and the 401 session-expired redirect row.
- Acceptance: the access matrix covers all four routes and fails on a missing row. Finance gets 403 before 400 through `requires` on `onRequest` (guard.test.ts with a test-only write route, since no real denied write route exists before S5).
- Code against the docs: the permissions table and `aggregateMinGroupSize` (04 §4.5), problem codes and status (04 §4.4), cookie attributes (04 §5.2, ADR 0006), the `me` shape and `askEnabled` (04 A4), nav, landing, `?next=`, the forbidden page and not-found (04 §8.1 and §8.2).
- Commit order: every `feat` follows a `test` commit for its behaviour, and the one `refactor` comes last. No money is involved.

Not checked:
- Which files each commit touched. With no git access I can't tell whether a `feat` commit also changed test files (for example `test/helpers.ts`, `test/render.tsx`, `test/builders/user.ts` or the `App.test.tsx` deletion). `overrides.md` says that deletion was in the cycle 13 red commit.
- "Login works on the live URL for all three accounts". That needs the deployed service.
- The open question in `.ai-notes/S2/open-questions.md`, that `trustProxy: true` lets clients get round the rate limit. The code follows 04 §4.1 as written, so this is a spec decision for the user, not a gap.

---

## Proposed actions

1. **Login body gives 500, not 400.** Fix with a new red and green cycle. Red: `test(auth): reject a malformed login body with 400 validation_failed`, covering a missing password (path `password`) and a malformed email (path `email`). Green: `fix(auth): validate the login body through the route schema`, which declares `schema: { body: loginBodySchema }` so the zod type provider and the existing `VALIDATION_FAILED` mapping handle it, and drops the `.parse` in the handler.
2. **`me` retried about 7 s before the logged-out redirect.** Fix with a new red and green cycle. 04 §8.3 as a whole (waking, polling) is S9 scope per 06 §2, but its "never retry an ApiError" rule is what makes the S2 redirect in 04 §8.2 prompt. Red: `test(web): never retry a query that failed with an api error`, against a new `createQueryClient()` with the real options, counting `me` calls. Green: `fix(web): stop retrying queries that fail with an api error`, adding `src/queryClient.ts` and using it in `main.tsx`.

Verified locally for the reviewer's first "Not checked" item: no `feat`, `fix` or `refactor` commit in `main..HEAD` touches a `*.test.*` file or anything under `test/`. `test/helpers.ts`, `test/builders/user.ts`, `test/render.tsx` and the `App.test.tsx` deletion all went in `test(...)` commits.

## Outcome (user: "Do what you think the best")

| Finding | Red | Green |
| --- | --- | --- |
| 1 Login body 500 | bc16dbf | 0126e5f |
| 2 `me` retried before redirect | c345c44 | 57e6dc4 |
| Open question: X-Forwarded-For bypass | a55d3f4 | 535e0bf |

Finding 2's first test draft used `fetchQuery`, which never retries by default, so it passed against a plain `new QueryClient()`. It was rewritten through `useQuery` before the red commit and shown to fail against the default client.

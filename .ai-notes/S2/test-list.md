# S2 test list (U unit, I integration, C component)
- [x] U `password hashing round-trips, and a wrong password fails the comparison`: 05 §5.2 U row 3, already in `password.test.ts` (S1)
- [x] U `the production hash string uses scrypt$32768$8$3$`: 05 §5.2 U row 4, already there (S1)
1. [x] U `the permissions table matches 04 section 4.5, action by action` (it.each): 05 §5.2 U row 1
2. [x] U `aggregateMinGroupSize is 5 for Finance and 1 for the HR roles`: 05 §5.2 U row 2
3. [x] U `config uses the production scrypt cost unless overridden`: 03 §7 ("parameters are read from config"), extra
4. [x] I `logging in with correct details returns the me body and sets an HttpOnly, SameSite=Lax cookie`: 05 §5.2 I row 1 (it also asserts `Path=/` and `Max-Age=28800`)
- [x] I `matches the email after trimming and lower-casing it`: 04 A2 LoginBody, extra
5. [x] I `the cookie is Secure when NODE_ENV is production`: I row 2
6. [x] I `the session table stores the token's hash, not the token`: I row 5
7. [x] I `a wrong password and an unknown email return the same 401 body`: I row 3
8. [x] I `the 11th login attempt in a minute from one IP returns 429 with Retry-After`: I row 4
9. [x] I `counts login attempts per client IP taken from X-Forwarded-For`: 04 §4.1 `trustProxy`, extra
10. [x] I `me returns the role's permissions, today from the clock, and askEnabled false without an API key`: I row 9
11. [x] I `me returns askEnabled true when an API key is set`: 04 A4, extra
12. [x] I `me without a session returns 401 UNAUTHENTICATED`: 04 A4
13. [x] I `a session older than 8 hours returns 401`: I row 6, using `clock.advance`
14. [x] I `logout deletes the session, and the old cookie then returns 401`: I row 7
15. [x] I `logout without a session returns 204`: I row 8
16. [x] I `a guarded route returns 401 UNAUTHENTICATED when logged out`: 04 §4.3, on a test-only route
17. [x] I `a guarded route returns 403 FORBIDDEN when the role lacks the action`: 04 §4.3, test-only route
18. [x] I `a Finance user sending an invalid body to a write route gets 403, not 400`: I row 12 (D-043), test-only `employee.write` route
- [x] I `'public' always passes, and 'authenticated' needs a session but no action`: 04 §4.3 plus the planning decision on `me`, extra
19. [x] I `access matrix: every route, called logged out, returns 401 except the public ones`: I row 10
20. [x] I `access matrix: every route, called as each role, returns 403 exactly when 04 section 4.5 says the role lacks the action`: I row 11
21. [x] I `access matrix: Finance gets 403, not 400, on every write route it may not use`: I row 12 over the route catalog
22. [x] I `every registered route appears in the expected-access table`: I row 13
23. [x] I `authenticated responses carry Cache-Control: no-store`: 05 §5.0
24. [x] I `logs redact the cookie header, password and any *Minor field`: 05 §5.0, captured pino stream
25. [x] C `the API client turns a problem response into an ApiError with its code`: 05 §5.9
26. [x] C `shows "Email or password is incorrect." on a 401`: 05 §5.2 C row 1
27. [x] C `shows the wait in seconds on a 429`: C row 2
28. [x] C `sends HR roles to /employees and Finance to /insights after login`: C row 3
29. [x] C `shows each role only its nav links` (it.each): 04 §8.1 landing table, extra. The Ask link stays out until S8 (C row 6).
30. [x] C `shows the forbidden page, not a redirect, when Finance opens /employees`: C row 5
31. [x] C `shows the not-found page for an unknown path`: 04 §8.1, extra
32. [x] C `logs out from the user menu and returns to /login`: 04 §8.1, extra
33. [x] C `honours ?next= only when the role may open that route`: C row 4
34. [x] C `redirects a logged-out visitor to /login?next=<path>`: 04 §8.2, extra
35. [x] C `a 401 after login clears the cache and redirects to /login?next= with the session-expired notice`: 05 §5.9

36. [x] C `sends / to the role's landing page` (it.each): 04 §8.1 `/` row, extra (added after cycle 14; not in the approved list)

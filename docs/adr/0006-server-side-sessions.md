# ADR 0006: Server-side sessions in an HttpOnly cookie, scrypt password hashing

- Status: Accepted (settles "session cookie or JWT" from decisions.md)
- Date: 2026-10-09

## Context

Three seeded roles log in with email and password (D-002). The browser and API share one origin (ADR 0002). Salary data is sensitive, so logout must really end access, and a token must not be readable by page scripts. There is one API instance, and the database is already queried on every request.

## Decision

- **Session token:** on login, generate 32 random bytes. Store only their SHA-256 in `sessions` with an 8-hour absolute expiry. Send the raw token in cookie `sid`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production.
- **Per request:** the auth plugin resolves the cookie to a user with one primary-key lookup. Logout deletes the row.
- **CSRF:** a same-site `Lax` cookie, plus write endpoints that accept only JSON bodies.
- **Passwords:** Node's built-in `crypto.scrypt`, N=2^15, r=8, p=3, 16-byte salt, self-describing stored string, constant-time comparison. These parameters are one of OWASP's equivalent scrypt settings, chosen for a 32 MiB memory cost per hash on a 512 MB free instance.
- **Login protection:** login is rate-limited per IP, and wrong email and wrong password return the same error.

## Alternatives considered

- **JWT in a cookie or header.** Stateless verification brings nothing with one server and a database we already query. A JWT can't be revoked before it expires without adding a denylist, which is a session table by another name. Refresh-token rotation adds code for no user-visible benefit.
- **Argon2id.** OWASP's first choice, but it needs a native addon, while scrypt (OWASP's second choice) ships with Node.
- **bcrypt.** Legacy choice per OWASP, with a 72-byte input limit.
- **Signed-cookie sessions with no server state.** Same revocation problem as JWT.

## Consequences

- Logout and the demo reset (which clears `sessions`) end access immediately.
- One extra indexed read per request, negligible next to the query the request makes anyway.
- Storing only the token hash means a leaked database copy can't be replayed as live sessions.
- Session expiry is absolute, not sliding. A user who works past 8 hours logs in again. Sliding expiry is a later change to one function.

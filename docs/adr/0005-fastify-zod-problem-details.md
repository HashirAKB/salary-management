# ADR 0005: Fastify 5 with shared zod contracts and problem-details errors

- Status: Accepted
- Date: 2026-10-09

## Context

The API needs request validation, typed handlers, structured logging and HTTP-level tests that run fast with no network. The web app needs the same validation rules for forms and URL filters, and predictable error shapes to show field messages and business-rule errors.

## Decision

- **Framework:** Fastify 5.
- **Validation and types:** zod v4 schemas in `packages/shared`, wired into Fastify through `fastify-type-provider-zod` (v7 supports Zod 4.2+), so request types come from the schemas.
- **Tests:** HTTP integration tests use `app.inject()`, which runs the full request pipeline in-process without opening a port.
- **Errors:** RFC 9457 problem details (`application/problem+json`) with `type`, `title`, `status`, `detail`, a stable `code`, and an `errors` array of `{ path, message }` for validation failures. Status codes are listed in `03-architecture.md` section 6.
- **Logging:** Fastify's built-in pino logger, with redaction of cookies, passwords and any `*Minor` money field.

## Alternatives considered

- **Express 5.** Familiar, and now handles async errors. But validation, typed request bodies, structured logging and in-process testing (supertest) each need a separate library and glue code that Fastify ships built in.
- **Hono.** Light and modern, but a smaller ecosystem for the plugins we use (rate limit, static files, cookies).
- **A custom error JSON shape.** Works, but problem details is a published standard the reviewer will recognise, and it already has fields for everything we need.

## Consequences

- Route handlers receive parsed, typed input. Invalid input never reaches a service.
- The web app's API client maps every error to one TypeScript type and shows `errors[]` next to form fields.
- Fastify's plugin encapsulation keeps the auth decorator and role guard in one place.
- The team (me) is more fluent in Express. The cost is learning Fastify's plugin and hook model, which is small at this size.

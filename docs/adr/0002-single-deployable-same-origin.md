# ADR 0002: One deployable serving API and UI from the same origin

- Status: Accepted (amends D-005; hosting confirmed in Chat 8 / `08-deploy-perf-demo.md`)
- Date: 2026-10-09
- Updated: 2026-10-11 in Chat 8. Status Accepted; cold-start policy recorded (accept free-tier spin-down; no keep-warm). Earlier: 2026-10-09 in Chat 7, Consequences aligned with D-045 (04 section 2).

## Context

D-005 proposed three free pieces: a Turso database, a Render web service for the API, and a separate free static site for the React build. Two origins mean the browser makes cross-origin calls, so the app needs one of these:
- CORS plus cookies sent cross-site (`SameSite=None`), which browsers increasingly restrict;
- tokens held in JavaScript, readable by any injected script;
- or a proxy from the static site to the API.

Render's static-site rewrites accept a full URL as the destination, but the docs don't say they forward POST bodies or cookies, so the proxy can't be relied on.

## Decision

Deploy one Render free web service. Fastify serves `/api/*` and the built React app, with an SPA fallback to `index.html`. The browser only ever talks to one origin. The database stays on Turso (D-005 unchanged on that point).

## Alternatives considered

- **Static site plus API with cross-site cookies.** Needs `SameSite=None` and CORS with credentials, and fails when a browser blocks third-party cookies.
- **Static site plus API with a bearer token in `localStorage`.** Works cross-origin, but any XSS bug can read the token.
- **Static site with a rewrite proxy to the API.** Undocumented for POST and cookies; we'd discover the gaps during the demo.

## Consequences

- No CORS configuration and a first-party `HttpOnly` cookie (ADR 0006).
- One build, one deploy, one URL in the README.
- Lost: the UI loads instantly from a CDN while the API wakes. On a cold start, the whole page waits for Render's spin-up (about a minute), and Render shows its own loading page, so the "waking the server" UI state isn't needed for the first visit. It is still needed when a tab outlives the 15-minute idle window: the next API call hits a sleeping instance, so the web app shows a waking banner and retries GETs (D-045, 04 section 8.3). Cold starts are accepted; there is no keep-warm ping (`08-deploy-perf-demo.md`).
- The API process serves static files, a trivial load at this scale.

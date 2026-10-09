# ADR 0004: Layered modular monolith with a pure domain core

- Status: Accepted
- Date: 2026-10-09

## Context

The brief rewards fast, deterministic tests and readable structure. Most of what can go wrong in this product is a rule: money conversion and rounding, percentiles, pay-equity gaps and suppression, salary-change rules, who may see what. Those rules should be testable without HTTP, a database or a clock. The app has five feature areas (auth, employees, salary, insights, ask) and runs as one process.

## Decision

- **Modules by feature** (`modules/auth`, `employees`, `salary`, `insights`, `reference`, `ask`), each with `routes.ts`, `service.ts` and `repo.ts`.
- **Layers:**
  - **routes** validate input with zod, check permission and call one service function;
  - **services** apply rules, run transactions and shape output by role;
  - **repositories** hold all SQL.
- **`domain/`** holds pure functions and the permissions table. It imports nothing from `db/`, `http/` or `modules/`. A lint rule (import restrictions) enforces this.
- **Composition root:** `buildApp({ db, clock, interpreter, config })` in `app.ts`. No DI container and no module-level singletons that read env.

## Alternatives considered

- **Hexagonal architecture with ports for every repository.** More interfaces than a 9-table app needs. We keep one port where it pays for itself: the LLM interpreter, which tests replace with a fake.
- **Fat route handlers.** Fastest to write, but rules end up testable only through HTTP.
- **Separate services (auth, employees, insights).** Network boundaries with no scaling or team reason behind them.

## Consequences

- Domain functions get plain unit tests. Services and routes get integration tests against an in-memory database through `app.inject()`.
- A new rule has an obvious home, and the import lint stops `domain/` from quietly reaching for the database.
- Some services pass data straight through to a repository. We accept that small duplication for consistent structure.

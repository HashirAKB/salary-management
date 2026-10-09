# ADR 0003: libSQL client, Drizzle as query builder, hand-written SQL migrations

- Status: Accepted (confirms D-006; works with D-025)
- Date: 2026-10-09

## Context

We need one database driver that works against a local file in development, an in-memory database in tests, and Turso in production (D-006). The schema in `02-data-model.md` relies on `STRICT` tables, `CHECK` constraints and a composite foreign key. List filters are dynamic (any combination of seven filters plus sort), so building SQL strings by hand would be error-prone. Turso's engine doesn't support some SQLite features, so we keep to a portable subset (D-025).

## Decision

- **Driver:** `@libsql/client` for all three environments (`file:`, `:memory:`, `libsql://`).
- **Query builder:** Drizzle ORM with its libSQL driver, used for typed queries only. `db/schema.ts` mirrors the tables.
- **Migrations:** plain SQL files in `db/migrations/`, applied in filename order by a small migrator (`db/migrate.ts`, about 50 lines) that records each file in a `schema_migrations` table. The SQL is the source of truth for constraints.
- **Drift guard:** an integration test compares each Drizzle table's columns with `PRAGMA table_info` after running the migrations.
- `PRAGMA foreign_keys = ON` on every connection.

## Alternatives considered

- **Drizzle Kit generating migrations.** Drizzle's docs don't show `STRICT` table support, and we won't drop type safety in the database to suit a generator.
- **Kysely.** A good SQL-first builder, but its libSQL dialect is a small single-maintainer package, and its types are hand-maintained interfaces that can drift from the schema unnoticed.
- **Prisma.** A generated client and a heavier toolchain for a 9-table schema; its own migration format again.
- **Raw SQL only.** Fine for the insights queries, which use `sql` templates anyway, but error-prone for the dynamic list filters.
- **better-sqlite3.** Fast and synchronous, but it can't talk to Turso (rejected in D-006).
- **Postgres on Neon.** Moves away from the brief's SQLite hint (rejected in D-006).

## Consequences

- Every SQLite feature we use is visible in one SQL file and checked against D-025 in review.
- Two places describe the schema (SQL and Drizzle). The drift test turns a mismatch into a failing build instead of a runtime bug.
- Tests get a fresh in-memory database per test in milliseconds: create client, run migrations, insert with builders.
- If Turso's engine rejects something at deploy time, the fallback is a libSQL-compatible host with no code change, because the protocol and client stay the same.

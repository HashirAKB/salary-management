### Spec review: S1
Verdict: GAPS FOUND

| # | Kind | Where | Spec | Problem | Failing test that would prove it |
| --- | --- | --- | --- | --- | --- |
| 1 | Correctness | apps/api/src/seed/generate.ts:1305 (diff line 1305) | 02 §7.8 | `TERMINATION_DAYS = 623` gives the window 2024-01-01 to 2025-09-14. The span from 2024-01-01 to 2026-09-15 inclusive is 989 days (366 + 365 + 258), so no seeded employee is terminated in the last 12 months of the range the spec requires. The comment says "to 2026-09-15 inclusive", but the number is a year short. The current test only checks the bounds, so it passes. Fixing this changes the recorded dataset hash. | it('spreads termination dates over the whole window, with some after 2026-01-01') |
| 2 | Correctness | apps/api/src/db/client.ts:7-9 (createDb, unchanged by the diff, which has no PRAGMA anywhere) | 02 §3 conventions; 06 S1 expected commit `feat(db): enable foreign keys on every connection` | 02 §3 says the db module runs `PRAGMA foreign_keys = ON` on every connection, because enforcement is off by default in SQLite and Turso. Nothing in the slice does that. The FK tests (integrity.test.ts and seed.int `PRAGMA foreign_keys`) pass only because the local libSQL build turns foreign keys on by default. The red commit d67e212 `test(db)` was therefore never red, and its feat commit is missing. In production on Turso, the composite FK "every employee has a band" may go unenforced. | it('createDb runs PRAGMA foreign_keys = ON when a connection opens') |

Checked: 05 §5.0 rows owned by S1: migrations idempotent, schema drift, FK rejection, in-memory transaction guard. 05 §5.1: all 12 rows, matched against generate/random/reference/report/cli/seed.int tests. 02 §3 DDL against 0001_init.sql (exact match). 02 §6 indexes I2-I7 and I12-I14. 02 §4: toUsdMinor and the SQL form (integer minor units, half up, convert per employee before the USD mean/median in report.ts). 02 §7.1-7.11 generator rules: allocation, gender split, gap targets, outliers, rounding, history, stale, market adjustment and correction, write order and reset, user upsert, report contents. ADR 0006 scrypt params. 05 §4.1/§4.2 testApp, testDb and builders. Acceptance: the hash is pinned in a test, and the CLI refuses missing or short passwords before opening the DB. Test-first order in commits.txt: every feat has an earlier test commit, apart from finding 2. The pulled-forward items (Faker A-008, password hashing, toUsdMinor) are approved in /home/hashirakb/Work/incubyte/salary-management/.ai-notes/S1/overrides.md.

Not checked: the "under 10 seconds locally" acceptance, which can't be judged without running it and has no test (05 §4.5 excludes performance). Which files each commit touched: I can't run git, so I couldn't confirm that feat/refactor commits (for example 971842f) leave test files alone or that red commits held only stubs. Whether Turso enforces foreign keys by default when no PRAGMA is sent: there are no docs on that in the repo.

---

## Proposed actions

**1. Termination window: fix with a new red and green cycle.** Confirmed: the window is 989 days inclusive, and the generated dates run 2024-01-09 to 2025-09-14. The red test checks that termination dates reach the last year of the window (some on or after 2026-01-01). The green changes `TERMINATION_DAYS` to 989. The pinned hash then changes. The hash test can only be updated in a `test(seed)` commit, so I'd re-record it in the red commit together with the new spread test; both fail until the green lands. The bound test (row 26) stays as it is.

**2. Foreign keys pragma: disagree for S1, and recommend a check in S2.** The plan flagged this before approval: the local client already enforces foreign keys, so no failing test can drive a pragma line, and d67e212 is labelled "Already satisfied by 37daa5b", with the proof of failure shown in the session. The reviewer's Turso risk is real, but a CI test can't reach Turso. Options:
- (a) Leave it. In S2, when the live database is seeded, run `PRAGMA foreign_keys` against Turso and record the result. If Turso reports 0, add the pragma test-first then.
- (b) Add the pragma now with a test that spies on the client's `execute` calls. That test checks a private call, which 05 §4.4 rules out.
I recommend (a).

## Outcomes
- Finding 1: **fixed**. fba4a1b test (spread over the window, hash re-recorded), afa1356 fix (989 days). afa1356 left row 26 red because of a month-end bug; fixed by feca494 (test: hash re-recorded) and 8e675d2 (fix: clamp month arithmetic). See overrides.md entry 5.
- Finding 2: **closed, checked live, no code change (you agreed)**. The web check found Turso's pragma reference: "Foreign key enforcement is off by default for SQLite compatibility" (https://docs.turso.tech/sql-reference/pragmas.md). You chose to check the live database first (option b). On 2026-10-10, with @libsql/client 0.18.0 over HTTP, against the live database (no tables yet), read-only:
  - `PRAGMA foreign_keys` reads 1 on a fresh client, on the next request, inside a write batch and inside an interactive transaction; it reads 0 inside `client.migrate`, which turns it off on purpose, so the reading is real.
  - Enforcement: one write batch with two TEMP tables and an orphan child row failed with `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`. The live database still has 0 tables afterwards.
  - So the live database enforces foreign keys today, despite the docs. No failing test can drive a pragma line locally or on Turso. Proposed: no change in S1. In S2, after the live seed, run `PRAGMA foreign_key_check` and `PRAGMA foreign_keys` once more and record the result.

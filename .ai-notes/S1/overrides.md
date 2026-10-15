# S1 overrides and decisions

## 1. Faker dependency (planning, BLOCKED stop)
- What I did: stopped because Faker is named only in 02 §7.2 and D-026, not in an ADR, 03 §5, 05 §3 or 06 (CLAUDE.md dependency rule). I recommended that you amend the docs first.
- What you said: "Amend the doc by yourself".
- What changed: I add amendment A-008 to `docs/decisions.md` naming `@faker-js/faker` 10.6.0, pinned exactly, then install it.
- Commits: the `docs:` A-008 commit and the `build(seed)` Faker commit (hashes in commits.txt).

## 2. Password hashing pulled into S1 (planning, BLOCKED stop)
- What I did: stopped because the seed CLI must hash the demo passwords (02 §7.1, S1 acceptance), but scrypt hashing is S2's cycle (06 S2, 05 §5.2 U rows 3 and 4).
- What you said: "Pull hashing into S1".
- What changed: cycle L builds `modules/auth/password.ts` with 05 §5.2 U rows 3 and 4. S2 drops those two commits.

## 3. toUsdMinor pulled into S1 (planning, BLOCKED stop)
- What I did: stopped because the seed report needs the org-wide gap in USD (02 §7.11), but 05 §5.6 schedules the `toUsdMinor` row for S7.
- What you said: "Pull it into S1".
- What changed: cycle C (shared `toUsdMinor`) and cycle D (TS/SQL agreement, 02 §7.12 item 7) come into S1.

## 4. Spec review decisions (after review)
- What I did: proposed fixing finding 1 (termination window 623 days instead of 989) test-first, and deferring finding 2 (no `PRAGMA foreign_keys = ON` in createDb) to a live Turso check in S2.
- What you said: "Fix finding one with your suggestion. We can check turso in s2. but I think there'll be some way to check that from here itself. atleast we can look on the web right."
- What changed: finding 1 fixed in fba4a1b (red) and afa1356 (green). For finding 2 I searched the web: Turso's pragma reference says "Foreign key enforcement is off by default for SQLite compatibility", so the production risk is real. That changes my earlier recommendation; the question is back with you.

## 5. Self-reported slip: green commit on a red tree
- What I did: committed afa1356 `fix(seed): terminate across the full window` with row 26 failing. My shell chain used `;` so the commit ran after the failing test run.
- Cause: the wider window produced a 2024-10-31 termination; "6 months earlier" rolled April 31 over to May 1, under six months before termination.
- What changed: feca494 (red: hash re-recorded for the fix) and 8e675d2 (fix: month arithmetic clamped to the month's last day). History not rewritten. Later commits gate `git commit` on `npm test &&`.

## 6. Finding 2 checked against the live database
- What I did: recommended checking the live Turso database (option b) before adding a pragma (option a).
- What you said: "Yeah do (b) first".
- What changed: read-only checks against the live Turso database show foreign keys on (reads 1) and enforced (an orphan row in TEMP tables failed with FOREIGN KEY constraint failed), although Turso's docs say off by default. Nothing was written to the live database (0 tables before and after). No code change proposed; the check repeats in S2 after the live seed.

## 7. CI timeout on the full-seed test (after push)
- What happened: `verify` failed: "running the seed twice leaves identical domain data and resets sessions and ask_log" timed out at Vitest's 5 s default on the CI runner.
- Cause: the test writes the full dataset twice and snapshots every table; 2.6 s locally, 3.9 s locally under coverage, which is what CI runs.
- What changed: seed.int.test.ts gives its two describe blocks a 30 s per-test timeout. Assertions unchanged; a 1 s limit was shown to apply and then restored. One test commit; see commits.txt.

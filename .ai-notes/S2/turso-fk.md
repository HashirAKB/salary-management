# S2: live Turso seed and foreign key check (S1 note 2)

Run by the user on 2026-10-10 from branch s2-login-and-roles.

`npm run seed` (reads .env): 10,000 active and 250 terminated employees, 43,185 salary history rows, report matching S1's expected values (outside band 569, stale 1,105, target cohorts flagged as designed).

`turso db shell incubytedb "PRAGMA foreign_keys; PRAGMA foreign_key_check;"`:

    FOREIGN KEYS
    1
    TABLE     ROWID     PARENT     FKID
    (no rows)

- `PRAGMA foreign_keys` = 1: the Turso shell connection has foreign key enforcement on, which matches S1's finding (.ai-notes/S1/review.md, finding 2) and contradicts Turso's docs saying it is off by default. The value is per connection; it shows this shell's connection, not necessarily every client's.
- `PRAGMA foreign_key_check` returned no rows: no orphaned references in incubytedb.
- Caveat: the agent could not read .env, so it has not verified that the seed run targeted incubytedb rather than a local file. The user should confirm (for example `turso db shell incubytedb "SELECT count(*) FROM employees"` returns 10250).

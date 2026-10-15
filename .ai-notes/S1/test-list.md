# S1 test list

| # | Done | Lvl | it(...) | Source | Cycle |
|---|---|---|---|---|---|
| 1 | [x] | I | runs every migration on an empty database, and running them again changes nothing | 05 §5.0 I row 1 | A |
| 2 | [x] | I | every Drizzle table's columns equal PRAGMA table_info for that table | 05 §5.0 I row 2 | B |
| 3 | [x] | U | toUsdMinor rounds half up to the cent (it.each) | 05 §5.6 U row 3 (pulled) | C |
| 4 | [x] | I | the SQL conversion form agrees with toUsdMinor | 02 §7.12 item 7 (pulled) | D |
| 5 | [x] | U | largestRemainder allocates counts that sum exactly to the total (it.each) | 05 §5.1 U row 8 | E |
| 6 | [x] | U | the seeded normal generator returns the same values for the same seed | 05 §5.1 U row 9 | E |
| 7 | [x] | U | the seeded uniform generator and shuffle repeat for the same seed and stay in range | 02 §7.2 (added) | E |
| 8 | [x] | U | normal draws have mean near 0 and standard deviation near 1 over 10,000 samples | 02 §7.2 (added) | E |
| 9 | [x] | U | generates 250 bands, one per country, title and level, each with min < mid < max | 05 §5.1 U row 3 (band half) | F |
| 10 | [x] | U | prices India Software Engineer L3 at INR 1,640,000 / 2,050,000 / 2,460,000 | 02 §7.4 (added) | F |
| 11 | [x] | U | generates the FX rates, 5 countries, 8 departments, 10 titles and 5 levels | 02 §4, §7.3 (added) | F |
| 12 | [x] | I | rejects a row that breaks a foreign key (foreign keys are on) | 05 §5.0 I row 3 | G |
| 13 | [x] | I | keeps data written in a transaction visible to the next read on an in-memory database | 05 §5.0 I row 4 | G |
| 14 | [x] | I | anEmployee().withHistory keeps the current-salary columns equal to the last row | 05 §4.2 (added) | G |
| 15 | [x] | U | creates exactly 10,000 active employees with the per-country counts of 02 §7.3 | 05 §5.1 U row 2 (active half) | H |
| 16 | [x] | U | allocates IN / Software Engineer / L3 as 280 people: 76 women, 195 men, 3 non-binary, 6 not disclosed | 02 §7.5 (added) | H |
| 17 | [x] | U | gives every employee a band | 05 §5.1 U row 3 (employee half) | H |
| 18 | [x] | U | normalises name_search to lower-case "first last" without diacritics | 02 §5 (added) | H |
| 19 | [x] | U | lands the four target cohorts within 0.1 points of their gap, with the expected flags, and keeps every other eligible cohort under 2.5% | 05 §5.1 U row 6 | I |
| 20 | [x] | U | keeps the outside-band share between 5% and 8% | 05 §5.1 U row 7 (band half) | I |
| 21 | [x] | U | rounds salaries to the nearest 100 major units, 1,000 for INR | 02 §7.6 (added) | I |
| 22 | [x] | U | starts each history with a hire row on the hire date, keeps dates increasing, ends no later than the reference or termination date, and ends on the current salary, title and level | 05 §5.1 U row 4 | J |
| 23 | [x] | U | changes level only on promotion rows, one rank up | 05 §5.1 U row 5 | J |
| 24 | [x] | U | keeps the stale share between 9% and 13% | 05 §5.1 U row 7 (stale half) | J |
| 24b | [x] | U | builds about 4 history rows per employee, using every change reason | 02 §7.7 expected volume (added) | J |
| 25 | [x] | U | creates exactly 250 terminated employees, spread across countries in proportion to headcount | 05 §5.1 U row 2 (terminated half) | K |
| 26 | [x] | U | terminates between 2024-01-01 and 2026-09-15, at least 6 months after hire, with codes E010001 to E010250 | 02 §7.2, §7.8 (added) | K |
| 26b | [x] | U | spreads termination dates over the whole window, with some in 2026 | spec review finding 1 | K2 |
| 27 | [x] | U | password hashing round-trips, and a wrong password fails the comparison | 05 §5.2 U row 3 (pulled) | L |
| 28 | [x] | U | the production hash string uses scrypt$32768$8$3$ | 05 §5.2 U row 4 (pulled) | L |
| 29 | [x] | I | after writeDataset, every employee's current-salary columns equal their latest history row, and foreign keys are on | 05 §5.1 I row 2 | M |
| 30 | [x] | I | running the seed twice leaves identical domain data and resets sessions and ask_log | 05 §5.1 I row 3 | M |
| 31 | [x] | I | upserts the three demo users by email, so a second run replaces their password hash | 02 §7.10 (added) | M |
| 32 | [x] | U | the seed report counts active, terminated, history rows, outside-band and stale employees | 02 §7.11 (added) | N |
| 33 | [x] | U | the seed report gives cohort gaps and flags, eligible cohorts, groups under 5, and org-wide USD mean and median gaps | 02 §7.11 (added) | N |
| 34 | [x] | I | the seed CLI exits with an error when a demo password variable is missing or shorter than 12 characters | 05 §5.1 I row 1 | O |
| 35 | [x] | I | the seed CLI migrates, writes the dataset, stores scrypt hashes for the demo users and prints the report | 02 §7.1 (added) | O |
| 36 | [x] | U | the same seed gives a deep-equal dataset, and the hash of its ordered rows matches the recorded value | 05 §5.1 U row 1 | P |

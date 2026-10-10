# 06 Build plan

Chat 6 output. The order in which Claude Code builds the product: vertical slices S0 to S10, each one test-first, merged on its own and demoable on its own, with time boxes, checkpoints and the cut order.
Inputs: `decisions.md`, `chat-plan.md`, `01-requirements.md`, `02-data-model.md`, `03-architecture.md`, `04-api-and-ui.md`, `05-test-strategy.md`.
Goes into the repo as `docs/06-build-plan.md`. Chat 7 turns each slice into a Claude Code prompt using the per-slice template; this file is what that prompt points at.
Updated in Chat 7 to match D-064 to D-068 and A-006 (the Claude Code kit): S0 hooks, where `.gitignore` comes from, how a slice starts, and who writes the log entry. No new decisions.

## 1. Decisions this file settles (proposed; logged in decisions.md at the end of this chat)

| ID | Decision | Why | Rejected alternatives |
| --- | --- | --- | --- |
| D-056 | Login and roles come before the first salary endpoint (S2, ahead of the employee list). This reorders the shape in `chat-plan.md`, where login was S4 | No build, local or deployed, ever serves salary data without a guard. Every data route is born with its `requires(action)` and its row in the access matrix (D-054), so no route needs a guard retrofitted later | List first, then auth (S2 and S3 would ship an open salary API to the live URL for half a day) |
| D-057 | One branch per slice (`s3-employee-list`), merged into `main` through a pull request with a merge commit. `main` is protected: CI must pass before merging. No squash, no rebase merge, no "require linear history" | The merge commit marks each slice's boundary and keeps every red, green and refactor commit (D-008). GitHub requires squash or rebase merges for linear history, so that setting stays off. Branch protection is free on public repositories | Committing straight to `main` (red commits would break `main`). Squash merge (destroys the TDD evidence). Rebase merge (loses the slice boundaries) |
| D-058 | CI runs on pull requests and on pushes to `main`, not on every branch push. Red commits live on slice branches and are expected to fail; they never land on `main` alone. A pull request is opened only when its branch head is green. Closes the open question "May red commits fail CI on a branch?" | `main` is green at every first-parent commit, which Render's `checksPass` deploy trigger relies on. Red commits still show in history as evidence, without a wall of red crosses in the GitHub UI | CI on every push (red crosses on every red commit). Marking red commits as expected failures in CI (machinery that adds nothing for the reviewer) |
| D-059 | Conventional Commits, checked by commitlint in a `commit-msg` hook. Red: `test(scope): <behaviour>`, test files plus "not implemented" stubs only. Green: `feat(scope)` or `fix(scope)`, production code only. Refactor: `refactor(scope)`, tests unchanged and green. The `pre-commit` hook runs lint-staged (Prettier and ESLint on staged files) and never runs tests. Claude Code's co-author trailer stays on its commits | The log reads as red, green, refactor without opening a diff. A test-running pre-commit hook would block every red commit. The co-author trailer is an honest record of AI pairing, which the brief asks to see | Free-form messages; tests in the pre-commit hook; removing AI trailers |
| D-060 | Each slice has a time box. Two checkpoints apply the cut order from `chat-plan.md` by rule: Saturday 21:30 and Sunday 12:00. Build work stops at Sunday 16:00 whatever its state. Each cut is logged in `decisions.md` when it's made, and anything unbuilt is listed in the README with its reason | Deciding cuts by rule at fixed times avoids discovering on Sunday afternoon that the demo can't be recorded. Logged cuts are product decisions, not quiet omissions | Cutting by feel when tired; extending the build into the submission buffer |
| D-061 | The skeleton deploy happens in S0: Render free web service from `render.yaml`, `autoDeployTrigger: checksPass`, Turso database created, `/api/health` live. Every merged slice then deploys itself. Chat 8 still confirms the final hosting setup (D-005, D-030 stay Proposed) | Deployment risk (cold starts, env vars, Turso connectivity) surfaces on day one, not in S9. `checksPass` deploys only `main` commits whose checks passed | Deploying first in S9 (any hosting surprise lands on Sunday afternoon) |
| D-062 | Node 24 LTS ("Krypton"), pinned in `.nvmrc` and in `engines.node` as `>=24.0.0 <25`. Render reads `.nvmrc` | Current LTS line; meets Vitest 5's Node 22.12+ requirement. Render advises an upper bound on version ranges | Node 26 (not yet LTS on the start date); Node 22 (older LTS for no reason) |
| D-063 | Render region `singapore`. Turso database in the Turso region closest to it, picked at S0 and recorded in the S0 commit | A Render service's region can't be changed after creation, so it's decided before S0. Singapore is Render's closest region to India, where I record the demo and where I assume the reviewers are. Chat 8 can still move the database | Oregon, Render's default (about 250 ms further from India on every request) |

## 2. Changes this file makes to earlier docs

| Doc | Change | Reason |
| --- | --- | --- |
| `chat-plan.md` Chat 6 "likely shape" | Login moves from S4 to S2; list paging becomes S3; search, filters, sort and CSV export become S4; the waking-state client moves to S9 with deploy hardening | D-056; the waking state belongs with deploy |
| `decisions.md` Open questions | "May red commits fail CI on a branch?" removed | Closed by D-058 |
| `04-api-and-ui.md` 8.3 | Unchanged in content; built in S9 rather than with the first API client in S2 | Slice sizing |

## 3. Working agreement (applies to every slice)

### 3.1 The loop

1. Create the branch `s<N>-<name>` from `main`.
2. Start a fresh Claude Code session in plan mode and run `/tdd-slice S<N>` with the per-slice prompt from `.ai-notes/slice-prompt-template.md` (D-068). The skill reads this slice and its 05 rows, writes the test list to `.ai-notes/S<N>/test-list.md`, and waits for approval of the plan (D-010).
3. For each group of 1 to 4 related tests:
   - **Red.** Write the tests. Add "not implemented" stubs for any new export (`throw new Error('not implemented')`), so the run fails on an assertion or that error, never on an import or syntax error. Run the tests and see them fail. Commit `test(scope): ...`.
   - **Green.** Write the least production code that passes. Run the whole project's tests. Commit `feat(scope): ...` or `fix(scope): ...`.
   - **Refactor** when there's something worth improving (expect about one cycle in three). Tests unchanged and green. Commit `refactor(scope): ...`.
4. `chore`, `build`, `ci`, `docs` and `style` commits are for changes with no behaviour (config, wiring, docs).
5. At the end: `npm run lint && npm run typecheck && npm run test:coverage` green, then I push and open the pull request (Claude never pushes, D-068), wait for CI, merge with a merge commit, and check the live URL after Render deploys.
6. `/tdd-slice` appends the slice's entry to `.ai-notes/log.md` (prompt, commit range, overrides, reviewer findings) and I check it: the prompts used, where the agent was corrected or overridden, and the commit hashes involved (00 brief analysis, risk 3).

### 3.2 Commit messages

- Format: `type(scope): subject`. Subject in lower case, imperative or behaviour-describing, no full stop, under 72 characters.
- Scopes: `api`, `web`, `shared`, `db`, `seed`, `auth`, `employees`, `salary`, `insights`, `export`, `ask`, `e2e`, `deploy`, `docs`.
- A red subject names the behaviour under test, so it reads like the test name: `test(salary): reject a merit raise that changes the level`.
- A green subject names the capability: `feat(salary): enforce same position for merit and market adjustments`.
- History is never rewritten after a push: no amend, no force push, no squash.
- The `commit-msg` hook also runs `scripts/check-commit-shape.mjs` (A-006): a `test` commit must include a test file, `feat` and `fix` must not change test files, and `refactor` must not change tests and production code together.

Example cycle from S6:

```
test(salary): reject a merit raise that changes the level
feat(salary): enforce same position for merit and market adjustments
refactor(salary): table-drive the per-reason rules
```

### 3.3 Repository settings (set in S0)

- Public GitHub repository. Default branch `main`.
- Branch protection on `main`: require a pull request, require status check `verify` (and `e2e` from S9), block force pushes. "Require linear history" off.
- Merge button: "Allow merge commits" on; squash and rebase merging off.
- Pull request template: slice goal, test list with boxes, docs links, demo note.

### 3.4 CI (`.github/workflows/ci.yml`)

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build
  # e2e job added in S9: needs verify, installs Chromium, runs npm run e2e
```

No secrets in CI. The Ask eval never runs in CI (D-053). Action versions are pinned to the current major at S0.

### 3.5 Definition of done for every slice

- Every test in the slice's list exists, with the name given or a clearer one, and passes.
- Each behaviour arrived through a red commit followed by a green commit.
- Lint, typecheck and coverage floor (D-052) are green. No `skip` or `only` left in tests.
- New endpoints are in the access matrix (D-054) and return problem details on every error path.
- The pull request is merged with a merge commit, and the live URL shows the slice's demo.
- The `.ai-notes/log.md` entry is written.

## 4. Schedule

About 18.5 hours of build time, between Chat 7 on Saturday morning and Chat 9 on Sunday afternoon. Times are local (IST).

| When | Work | Box |
| --- | --- | --- |
| Sat 08:00 to 10:00 | Chat 7: Claude Code kit, dry run | 2 h |
| Sat 10:00 to 11:30 | S0 Walking skeleton | 1.5 h |
| Sat 11:30 to 13:30 | S1 Schema and seed | 2 h |
| Sat 14:00 to 16:00 | S2 Login and roles | 2 h |
| Sat 16:00 to 17:30 | S3 Employee list with paging | 1.5 h |
| Sat 17:30 to 19:00 | S4 Search, filters, sort, CSV export | 1.5 h |
| Sat 19:30 to 21:30 | S5 View, add, edit, terminate | 2 h |
| **Sat 21:30** | **Checkpoint A** | |
| Sat 21:30 to 22:30 | Chat 8: deploy, performance, demo script (Project chat) | 1 h |
| Sun 08:00 to 10:00 | S6 Salary change and history | 2 h |
| Sun 10:00 to 12:00 | S7 Insights and pay equity | 2 h |
| **Sun 12:00** | **Checkpoint B** | |
| Sun 12:00 to 13:30 | S8 Ask about pay | 1.5 h |
| Sun 13:30 to 14:30 | S9 Deploy hardening and smoke test | 1 h |
| Sun 14:30 to 16:00 | S10 README, performance note, demo video, AI notes | 1.5 h |
| **Sun 16:00** | **Build stops** | |
| Sun 16:00 to 17:30 | Chat 9: final review | 1.5 h |
| Sun 18:00 | Submit | |

This plan has no slack: an overrun in any slice moves everything after it. The checkpoints exist because of that.

### 4.1 Cut order (from `chat-plan.md`) and where each cut lands

| Cut | What | Slices affected | Saves about | Cost to the product |
| --- | --- | --- | --- | --- |
| 1 | Outlier insights: `band` and `salaryUnchangedSince` list filters, and the outside-band and stale-salary cards | S4, S7 | 40 min | "Who is outside their band" and "whose salary is stale" are no longer one click; Ask still answers the outside-band count |
| 2 | CSV export (import is already out) | S4 | 30 min | HR can't take a filtered list to Excel |
| 3 | Playwright smoke test | S9 | 45 min | No automated check of the built bundle; S9's manual live check remains |
| 4 | UI polish: charts, the band bar, live previews in the add and salary forms, skeleton loaders (replaced by a plain loader) | S5, S6, S7 | 60 min | Plainer screens; every number still shown in tables |
| 5 | Narrow Ask to ungrouped questions with metrics headcount, total, average and median | S8 | 30 min | Fewer question types; the structured-query design and its safety stay the same |

Never cut: the test-first history, the deployment, the demo video, the docs.

Note on cut 1: the D-041 design made outlier insights cheap (two filters and two counts), and they answer persona questions from 01. I'd keep them unless the checkpoint rule fires.

### 4.2 Checkpoint rules

- **Checkpoint A, Saturday 21:30.** S5 not merged: apply cuts 1 and 2 (remove them from S4 if S4 isn't merged, or leave them out of later slices), and finish S5 before starting Chat 8.
- **Checkpoint B, Sunday 12:00.** S7 not merged: apply cuts 3 and 4. S6 not merged either: also apply cut 5.
- **Sunday 16:00.** Stop. Unmerged work stays on its branch and isn't merged. The README's "Not built" section lists it with the reason.

Each applied cut becomes an amendment line in `decisions.md` at the moment it's applied (D-060).

## 5. Slices

Each slice lists: goal, demo, scope, test list (pointing at rows in `05-test-strategy.md`; "all" means every row of that level in the section), acceptance criteria, expected commits, docs, and cut markers. Commit lists show the expected shape; the exact number of red, green and refactor cycles follows the test groups.

---

### S0 Walking skeleton

**Goal.** A repo where `npm test`, CI and a live deploy all work end to end, with no product features.

**Demo.** The live URL shows an "ACME Salary Manager" placeholder page; `/api/health` returns `{ "status": "ok" }` from Turso; a pull request shows a green `verify` check.

**Scope.**
- npm workspaces (`apps/api`, `apps/web`, `packages/shared`), `tsconfig.base.json`, `tsc -b` builds (D-038).
- ESLint with determinism rules (D-051) and the `domain/` import restriction (ADR 0004); Prettier.
- Vitest 5 projects and setup files (05 section 3.1); coverage config with the D-052 floor.
- Husky v9: `pre-commit` runs lint-staged, `commit-msg` runs commitlint with `@commitlint/config-conventional`, then `node scripts/check-commit-shape.mjs "$1"` (D-059, A-006).
- `.gitignore` (`node_modules/`, `dist/`, `.ai-notes/`, `.env`, `*.db`, `e2e/.data/`, `.vitest/`) is already committed with the Claude Code kit before S0 (D-067); S0 adds any entry it finds missing in a `chore` commit. `.env.example` with every variable from 03 section 8. `.nvmrc` with `24`.
- `config.ts` (zod), `createDb`, `fixedClock` and `systemClock`, `buildApp`, problem-details error handler, `/api/health`, `@fastify/static` serving the Vite build with the SPA fallback (04 section 8.1).
- Web: Vite, React 19.2, Mantine provider, a placeholder page, the test render wrapper.
- Supporting packages from A-007: `typescript-eslint`, `@types/node`, `@types/react`, `@types/react-dom`, `@mantine/hooks`.
- CI workflow (3.4), branch protection and merge settings (3.3), PR template.
- `render.yaml`: `type: web`, `runtime: node`, `plan: free`, `region: singapore`, `buildCommand: npm ci && npm run build`, `startCommand: node apps/api/dist/main.js`, `healthCheckPath: /api/health`, `autoDeployTrigger: checksPass`; `DATABASE_URL` and `DATABASE_AUTH_TOKEN` with `sync: false`. Turso database created and its URL and token set in Render.

**Test list.**
- 05 section 5.0: the 404 `ROUTE_NOT_FOUND` row, the static `index.html` row, the 415 row, the 500 row, the health row, and the three U rows (config, problem builder, zod errors).
- Canary: one component test that renders the placeholder through the test wrapper with an MSW handler (05 open question 2).

**Acceptance.**
- `npm ci && npm test` passes on a fresh clone with Node 24.
- A deliberately failing commit on a branch doesn't trigger CI; the pull request at a green head shows `verify` green; merging deploys.
- The live `/api/health` answers 200 within a minute of a cold start.
- `git log --oneline` shows the docs commits, then `chore: add claude code kit and gitignore` (D-067), before the first S0 commit (D-008, H7).

**Expected commits.**
```
chore: scaffold npm workspaces and TypeScript project references
chore: add ESLint, Prettier and determinism lint rules
chore: add Vitest 5 projects and coverage floor
chore: add husky, lint-staged, commitlint and commit-shape hooks
test(api): reject invalid configuration with a list of problems
feat(api): validate environment with zod
test(api): return problem details for unknown api routes and errors
feat(api): add problem-details error handler and 404 handler
test(api): report health when the database answers
feat(api): add buildApp composition root and health route
test(web): render the app shell placeholder through the test wrapper
feat(web): add Vite, React and Mantine placeholder page
test(api): serve index.html for non-api paths
feat(api): serve the web build with an spa fallback
ci: run lint, typecheck, tests and build on pull requests and main
build(deploy): add render.yaml for one free web service
```

**Docs.** 03 sections 5, 6, 8, 10; ADR 0002, 0003, 0004, 0005; 04 sections 4.1, 4.4, 8.1; 05 sections 3 and 4.

**Cut markers.** None.

---

### S1 Schema and seed

**Goal.** The full schema, migrations, and a deterministic 10,000-employee seed.

**Demo.** `npm run seed` prints the seed report (02 section 7.11): 10,000 active and 250 terminated, the four target cohorts with their gaps, outside-band and stale counts.

**Scope.**
- `db/migrations/0001_init.sql`: the DDL of 02 section 3 and indexes I2 to I7 and I12 to I14 (02 section 6). Migrator with `schema_migrations`. `db/schema.ts` in Drizzle.
- `seed/random.ts`, `seed/generate.ts` (pure), `seed/write.ts`, `seed/cli.ts` (02 section 7). The pure band generator is exported for test builders.
- Test builders: `aReferenceSet()`, `anEmployee()` with `withHistory`, and `testApp()` (05 section 4.2). `aUser` and `loggedInAs` come in S2.
- The seed runs locally only in this slice. The live database is seeded in S2.

**Test list.**
- 05 section 5.0: migrations idempotent, schema drift, foreign keys, in-memory transaction guard.
- 05 section 5.1: all rows.

**Acceptance.**
- The seed finishes in under 10 seconds locally, including password hashing.
- The dataset hash is recorded in the test and matches on CI.
- The seed refuses to run without the three demo password variables.

**Expected commits.**
```
test(db): apply migrations once and skip them on a second run
feat(db): add sql migrator and initial schema
test(db): keep drizzle tables in step with the sql schema
feat(db): add drizzle schema mirroring the migration
test(db): reject a foreign key violation and keep data across a transaction
feat(db): enable foreign keys on every connection
test(seed): allocate counts with largest remainder and seeded normals
feat(seed): add seeded random utilities
test(seed): generate 250 bands with min below mid below max
feat(seed): generate reference data and pay bands
test(seed): allocate 10000 active employees across cohorts and genders
feat(seed): allocate employees to cohorts
test(seed): land the four target gender gaps and outlier shares
feat(seed): shape current salaries, gaps and outliers
test(seed): build histories that end on the current salary and position
feat(seed): build salary histories backwards from current pay
test(seed): generate 250 terminated employees
feat(seed): generate terminated employees
test(seed): refuse to run without demo passwords
feat(seed): add seed cli with reset, users and report
refactor(seed): extract cohort targets into a config table
```

**Docs.** 02 sections 3 to 7; ADR 0003; 05 sections 4.1, 4.2, 5.0, 5.1.

**Cut markers.** None.

---

### S2 Login and roles

**Goal.** Three demo accounts log in, each sees the right navigation, and every route is guarded by role.

**Demo.** On the live URL, log in as HR Admin, HR Viewer and Finance. The nav differs by role, Finance lands on a placeholder `/insights`, and `/employees` shows the forbidden page for Finance.

**Scope.**
- `domain/permissions.ts` (04 section 4.5), password hashing with config-driven scrypt parameters, sessions repository, auth plugin (`onRequest`), `requires(action)` guard (`onRequest`, D-043), route catalog in `buildApp`, login rate limit behind the proxy (trusting only the proxy hop, 04 section 4.1), A2 to A4, `Cache-Control: no-store`, log redaction.
- Shared schemas `common.ts`, `problem.ts`, `auth.ts`.
- Web: API client (problem parsing; the waking logic comes in S9), `useSession`, login page, `AppShell` with the nav gated by `permissions`, route guards, landing redirect, forbidden and not-found pages, placeholder pages for the later screens.
- Builders `aUser`, `loggedInAs`.
- The live Turso database is seeded once with the seed CLI and the demo passwords from the deployment env.

**Test list.**
- 05 section 5.2: all U and I rows, C rows 1 to 5 (the Ask nav row, C row 6, comes in S8).
- 05 section 5.0: `Cache-Control` row, log redaction row.
- 05 section 5.9: the `ApiError` row and the 401 redirect row.

**Acceptance.**
- The access matrix test covers every route registered so far, and a route missing from the expected-access table fails the build.
- Finance gets 403 before 400 on write routes.
- Login works on the live URL for all three accounts.

**Expected commits.**
```
test(auth): define allowed actions per role
feat(auth): add permissions table and minimum group size
test(auth): hash and verify passwords with configurable scrypt cost
feat(auth): add scrypt password hashing
test(auth): log in, set a secure session cookie and store only its hash
feat(auth): add login with server-side sessions
test(auth): return the same 401 for wrong password and unknown email
test(auth): rate limit login attempts per ip
feat(auth): add login rate limit behind the proxy
test(auth): expire sessions after 8 hours and delete them on logout
feat(auth): add session expiry and logout
test(auth): return the viewer, permissions and today from me
feat(auth): add me endpoint
test(api): guard every route by role before validation
feat(api): add requires guard and route catalog
test(api): check every route against the expected access table
test(api): redact cookies, passwords and money fields in logs
feat(api): add no-store caching and log redaction
test(web): show login errors and land each role on its page
feat(web): add login page and session handling
test(web): gate nav and routes by permissions
feat(web): add app shell, route guards and forbidden page
refactor(web): extract api client problem parsing
```

**Docs.** ADR 0006; 03 section 7; 04 sections 4.3, 4.5, 5.2, 8.1, 8.2; 05 section 5.2.

**Cut markers.** None.

---

### S3 Employee list with paging

**Goal.** HR roles page through all active employees, sorted by name.

**Demo.** HR Viewer opens `/employees` and sees "Showing 1 to 50 of 10,000 employees" with salaries in local currency and USD. Changing the page and page size works.

**Scope.**
- R1 reference endpoint; E1 with `page`, `pageSize`, `status` and default name sort (filters, search and other sorts come in S4); USD conversion and band position in the list query.
- Shared `reference.ts`, `employee.ts` (list parts), `money.ts`, `percent.ts` (04 section 8.4.1).
- Web: `format.ts`, `Money` and `FxAsOf` components, `EmployeeListPage` with table, pager, page size, skeleton, empty and error states.

**Test list.**
- 05 section 5.3: U rows 1 and 2; I rows 1, 2 and 12 (default list, past-the-end page, item fields); C rows 1, 6 and 7 (rows and count line, error, role buttons).
- 05 section 5.9: the five U formatting rows.
- 05 section 5.6: the TS and SQL USD conversion agreement row (needed for the list's USD column).

**Acceptance.**
- The default page answers in under 300 ms locally at 10,000 rows (rough check; Chat 8 measures properly).
- Percentages and compa-ratio follow 04 section 8.4.1 for every case in the 05 section 5.9 table: a value that rounds to zero shows `0.0%` (never `+0.0%` or `-0.0%`), null shows `n/a`, and ties round away from zero.

**Expected commits.**
```
test(api): return reference data for filters and forms
feat(api): add reference endpoint
test(employees): page active employees by name with totals
feat(employees): add employee list endpoint with offset paging
test(shared): convert to usd half up and agree with the sql form
feat(shared): add money conversion helpers
test(web): format money, dates and percentages
feat(web): add formatting helpers
test(web): render the employee table with count and pager
feat(web): add employee list page
```

**Docs.** 04 sections 5.3, 5.4 (E1), 8.4, 8.5 S-2; 02 sections 4 and 6 (I2); 05 sections 5.3 and 5.9.

**Cut markers.** Cut 4: skeleton rows become a plain loader.

---

### S4 Search, filters, sort and CSV export

**Goal.** HR finds anyone in seconds, shares the view as a URL, and takes it to Excel.

**Demo.** Search "muller" finds "Müller"; filter India, Software Engineer, L3; copy the URL into a new tab and see the same view; sort by USD salary; export the view to CSV and open it in Excel.

**Scope.**
- E1: `q`, `country`, `department`, `jobTitle`, `level`, `gender`, `band`, `salaryUnchangedSince`, `sort`, `order`; unknown-param rejection.
- X1 CSV export and `csv.ts` (D-044).
- Web: filter bar, `useEmployeeFilters` (URL state), sort headers, "Export CSV".

**Test list.**
- 05 section 5.3: all rows not done in S3.
- 05 section 5.7: all rows.

**Acceptance.** Every filter combination the UI can produce round-trips through the URL; the export matches the screen's filtered rows and order.

**Expected commits.**
```
test(employees): search by name without accents and by employee code
feat(employees): add name and code search
test(employees): filter by country, department, title, level, gender and status
feat(employees): add list filters
test(employees): filter by band position and stale salary date
feat(employees): add band and stale-salary filters
test(employees): sort by usd salary with stable ties and reject unknown params
feat(employees): add sorting and strict query params
test(export): write excel-safe csv with bom, crlf and formula guard
feat(export): add csv builder
test(export): export the same rows and order as the list
feat(export): add employee csv export endpoint
test(web): keep list filters in the url and reset the page on change
feat(web): add filter bar and url state
test(web): export the current filters as csv
feat(web): add export button
```

**Docs.** 04 sections 4.6, 5.4 (E1), 5.7, 8.3 (URL state), 8.5 S-2; 05 sections 5.3 and 5.7.

**Cut markers.** Cut 1: the `band` and `salaryUnchangedSince` filters and their tests. Cut 2: everything under `export`.

---

### S5 View, add, edit, terminate

**Goal.** HR Admin keeps employee records correct; HR Viewer can read them.

**Demo.** Open an employee and see the band bar and compa-ratio; add a new hire (with an outside-band warning); fix a name; terminate someone and see them leave the default list.

**Scope.**
- E2, E3, E4, E5, R2. Employee code assignment and the hire row in one transaction.
- Shared `PersonName`, create, update and terminate schemas.
- Web: `EmployeeDetailPage` (header, current salary card with band bar, details card, history placeholder), add page with band preview, edit modal, terminate modal.

**Test list.**
- 05 section 5.4: all rows.

**Acceptance.** A PATCH with `jobTitleId` is rejected with 400 naming the key; a terminated employee disappears from the default list and the insights headcount (insights checked again in S7).

**Expected commits.**
```
test(employees): show one employee with band and compa-ratio
feat(employees): add employee detail endpoint
test(shared): reject empty, long and formula-leading names
feat(shared): add person name schema
test(employees): create an employee with code, hire row and current salary
feat(employees): add create employee
test(employees): reject future hire date, wrong currency and missing band
feat(employees): add create rules
test(employees): edit name and gender only
feat(employees): add employee edit
test(employees): terminate once, not before hire or in the future
feat(employees): add termination
test(web): show employee detail with role-based actions
feat(web): add employee detail page
test(web): add an employee with band warning and field errors
feat(web): add new employee page
test(web): edit details and terminate from the detail page
feat(web): add edit and terminate modals
refactor(employees): share employee detail mapping between endpoints
```

**Docs.** 04 sections 5.3 (R2), 5.4, 8.5 S-3 to S-5 and S-7, 8.6; 02 section 5; 05 section 5.4.

**Cut markers.** Cut 4: band bar (show min, mid and max as text) and the add form's live band preview (keep the server's 422 for a missing band).

---

### S6 Salary change and history

**Goal.** HR Admin records a raise, promotion or correction, and anyone in HR can see exactly how someone's pay got where it is.

**Demo.** Record a 5% merit raise for an employee; then a promotion from L2 to L3 for another, and see "L2 Intermediate to L3 Senior" in the history; try a merit raise that changes the level and see the error on the level field.

**Scope.**
- `domain/salary-rules.ts`, S1 and S2 endpoints, the transaction writing history and current salary (D-021), the history projection with previous values (D-025).
- Shared `salary.ts`.
- Web: history table on the detail page, salary change modal with reason-driven fields and 422 mapping.

**Test list.**
- 05 section 5.5: all rows.

**Acceptance.**
- After any change, the employee's current-salary columns equal their latest history row (the invariant test from S1 still passes on a database touched by the app).
- For the same amounts, the history's Change column and the salary form's preview show the same value, both from shared `changePct`. The hire row shows `n/a`, and a change under 0.05% in either direction shows `0.0%`.

**Expected commits.**
```
test(salary): accept a date equal to the current salary date, reject future and earlier dates
feat(salary): add date rules
test(salary): require a raise and same position for merit and market adjustment
feat(salary): add merit and market adjustment rules
test(salary): require a raise and a higher level for promotion
feat(salary): add promotion rules
test(salary): allow lower pay on correction but reject no change
feat(salary): add correction rules
refactor(salary): table-drive the per-reason rules
test(salary): record a change and update the current salary in one transaction
feat(salary): add salary change endpoint
test(salary): keep neither write when the second one fails
test(salary): list history newest first with previous values
feat(salary): add salary history endpoint
test(web): show history with imported rows and position changes
feat(web): add salary history table
test(web): lock fields by reason and map rule errors to fields
feat(web): add record salary change modal
```

**Docs.** 04 sections 5.5, 8.5 S-6, 8.6; 02 sections 4 and 5; D-019, D-021, D-022, D-029; 05 section 5.5.

**Cut markers.** Cut 4: the live preview under the salary form.

---

### S7 Insights and pay equity

**Goal.** Anyone can answer "how do we pay people" in one screen, and HR can see where women and men in the same role are paid differently.

**Demo.** As Finance: total payroll by country in USD; median by level for Software Engineers in India; a "Fewer than 5" row. As HR Admin: the pay-equity table with the three flagged cohorts, and the outside-band card linking to the filtered list.

**Scope.**
- `domain/percentiles.ts`, `domain/pay-query.ts` (engine, D-040), `domain/pay-equity.ts`, insights repository (active projection), I1, I2, I3.
- Shared `insights.ts`.
- Web: `InsightsPage` (cards, payroll by country, distribution with group-by), `PayEquityPage`.

**Test list.**
- 05 section 5.6: all rows except the TS and SQL conversion row (done in S3).
- The S5 acceptance check that terminated employees leave insights.

**Acceptance.**
- Distribution percentiles for the Excel fixture match `PERCENTILE.INC`; Finance never receives a group under 5 in any insights response (checked by the matrix-style test over all three endpoints).
- Gap % and share of payroll display per 04 section 8.4.1, including a gap that rounds to zero (`0.0%`, and `no measurable gap (0.0%)` in Ask) and a suppressed country's share (`n/a`).

**Expected commits.**
```
test(insights): compute percentiles like excel percentile.inc
feat(insights): add percentile function
test(insights): aggregate headcount, totals and averages in usd per group
feat(insights): add pay aggregation engine
test(insights): suppress groups under the minimum size
feat(insights): add minimum group suppression
test(insights): compute cohort gender gaps and flag at five percent
feat(insights): add pay equity computation
test(insights): return the summary for the hand-built fixture
feat(insights): add summary endpoint
test(insights): return pay distribution by each dimension
feat(insights): add pay distribution endpoint
test(insights): return pay equity cohorts with filters
feat(insights): add pay equity endpoint
test(web): show insights with suppressed rows and role-based links
feat(web): add insights page
test(web): show pay equity with not-comparable rows and review badges
feat(web): add pay equity page
refactor(insights): load the active projection once per request
```

**Docs.** 04 sections 5.6, 6, 8.5 S-8 and S-9; 02 section 4; D-012, D-013, D-024; 05 section 5.6.

**Cut markers.** Cut 1: the outside-band and stale-salary cards. Cut 4: the two charts (tables stay).

---

### S8 Ask about pay

**Goal.** Anyone can ask a pay question in plain English and see both the answer and how it was read, with no salary data sent to the model.

**Demo.** Ask "What is the median pay for a Senior Engineer in India?" and see the answer with "How I read your question"; ask "What does Priya Nair earn?" and see the refusal with a suggestion; show the eval report.

**Scope.**
- `QueryInterpreter`, `FakeInterpreter`, `AnthropicInterpreter` (SDK client injected), tool schema builder from reference data, system prompt, semantic rule, answer templates, caps over `ask_log`, K1, `askEnabled` in `me`.
- Shared `structured-query.ts`, `ask.ts`.
- `apps/api/evals/ask-eval.json` (05 section 6.3), the `npm run eval` script, and the first committed eval report.
- Web: `AskPage`, nav entry when enabled.
- Console: a dedicated workspace with a $5 monthly limit and a workspace-scoped key in Render's env (D-037).

**Test list.**
- 05 section 5.8: all rows.
- 05 section 5.2: the "hides Ask about pay" C row.

**Acceptance.**
- With no key, the app works and Ask is hidden; with a key, the live demo answers q01.
- The eval report scores at least 13 of 15, or its failures are each explained and the prompt changed and re-run.

**Expected commits.**
```
test(ask): keep the tool schema and zod schema in agreement
feat(ask): build strict tool schemas from reference data
test(ask): normalise enum casing and reject gender gap by gender
feat(ask): parse and check interpreted queries
test(ask): write answers and refusals from templates
feat(ask): add answer templates
test(ask): send strict tools and map stop reasons in the anthropic interpreter
feat(ask): add anthropic interpreter
test(ask): return 503 without a key and answer with the fake interpreter
feat(ask): add ask endpoint
test(ask): enforce per-user and global daily caps
feat(ask): add daily caps from the ask log
test(web): show answers, interpretation and refusals
feat(web): add ask page
chore(ask): add eval set and eval runner
docs(ask): record first eval run
```

**Docs.** ADR 0008; 03 section 9; 04 sections 5.8, 7, 8.5 S-10; 05 sections 5.8 and 6; D-003, D-004, D-015, D-036, D-037.

**Cut markers.** Cut 5: `metric` enum limited to headcount, total, average and median; `groupBy` fixed to `none`; drop the matching template and eval rows (logged as an amendment to D-015).

---

### S9 Deploy hardening and smoke test

**Goal.** The live link survives cold starts and reviewer use, and one automated test proves the built app works.

**Demo.** Leave the tab idle until the instance sleeps (or restart the service), click a filter, and watch the waking banner appear and clear; show the green `e2e` check.

**Scope.**
- Web: connection store with injected scheduler, `ServerStatusBanner`, waking detection and GET retry in the API client (D-045).
- Playwright config with `webServer` and `globalSetup` running the seed; `e2e/smoke.spec.ts` (05 section 5.10); `e2e` CI job; branch protection requires `e2e`.
- Live checks from `08-deploy-perf-demo.md` (Chat 8): env vars, `trustProxy` IP in logs, health check, cold-start time, demo reset mechanism as Chat 8 decides.

**Test list.**
- 05 section 5.9: the waking rows (C rows 2 to 5).
- 05 section 5.10: the smoke test.

**Acceptance.** The smoke test passes in CI; on the live URL, a request after spin-down shows the banner and then the data, with no error page.

**Expected commits.**
```
test(web): show the waking banner for slow and non-json responses
feat(web): add connection store and server status banner
test(web): retry gets after the server wakes and never retry writes
feat(web): add waking detection to the api client
test(e2e): log in, filter, record a raise and see the role differences
build(e2e): add playwright config with seeded database
ci: run the smoke test after verify
```

**Docs.** 04 sections 8.2 and 8.3; 05 sections 5.9 and 5.10; ADR 0002; `08-deploy-perf-demo.md`.

**Cut markers.** Cut 3: everything under `e2e` (the waking work stays).

---

### S10 README, performance note, demo, AI notes

**Goal.** A reviewer can understand, run and judge the submission in five minutes.

**Demo.** The README, `docs/performance.md`, the video link, and the committed `.ai-notes/`.

**Scope.**
- Performance script from Chat 8: list and insights timings at 10,000 rows with and without the indexes, written to `docs/performance.md` with the real numbers.
- README:
  - what it is and the live link with the cold-start note;
  - demo accounts;
  - five-minute local setup (`nvm use`, `npm ci`, `.env`, `npm run seed`, `npm run dev`);
  - how it works, with links to `docs/`;
  - how AI was used;
  - how to read the history (`git log --oneline --graph`);
  - "Not built" section for any applied cuts.
- Copy `docs/` from the Project (only sections 1 and 2 of 00, D-020).
- Review `.ai-notes/` and commit it once (D-007).
- Record the 3 to 5 minute demo from the Chat 8 script and link it.

**Test list.** None (docs only). The full suite and the live smoke check are re-run before the final commit.

**Acceptance.** A fresh clone following the README reaches a running app with seeded data; every link in the README works; no em dash characters in the README or docs.

**Expected commits.**
```
docs: record query timings at 10000 employees
docs: add readme with setup, demo accounts and design links
docs: add ai prompts and usage log
docs: link the demo video
```

**Docs.** `08-deploy-perf-demo.md`; 00 sections 1 and 2; D-007, D-020.

**Cut markers.** Never cut.

## 6. Acceptance criteria for this file

- [ ] Slices S0 to S10 each have a goal, demo, scope, test list, acceptance criteria, expected commits, docs and cut markers.
- [ ] Every test row in `05-test-strategy.md` is assigned to exactly one slice.
- [ ] Every slice fits in 2 hours or less, and the total fits the window before Chat 9.
- [ ] The cut order from `chat-plan.md` is mapped onto slices with savings and product cost, with checkpoint rules that apply it.
- [ ] The commit convention, hooks, branching, merge method and CI triggers are decided, and the red-commit question is closed.
- [ ] `.ai-notes/` is git-ignored before S0 (kit commit, D-067), and S0 includes the skeleton deploy.

## 7. Out of scope, and why

- **Preview deployments per pull request.** Not on Render's free plan path we use, and one live URL is enough for one developer.
- **Release tags and a changelog.** One submission; the merge commits mark the slices.
- **Dependabot and automated dependency updates.** Exact pins for a two-day build; updates would add noise to the graded history.
- **Parallel Claude Code sessions per slice.** Slices depend on each other in order, and one reviewer (me) checks each plan. Worktrees add coordination for no speed gain here.
- **Database migrations beyond `0001_init.sql`.** The schema is complete before any data exists; a second migration appears only if a slice finds a schema gap, and then it goes back to the 02 owner chat first (D-009).

## 8. Open questions

| # | Question | Default until answered | Owner |
| --- | --- | --- | --- |
| 1 | Which Turso region is closest to Render's Singapore region? | Pick at S0 from Turso's region list; record in the S0 commit | S0 |
| 2 | How does the live demo return to a known state after reviewer edits? | Carried from decisions.md; S9 implements whatever Chat 8 decides | Chat 8 |
| 3 | ~~How is TDD enforced in Claude Code (instructions, Stop hook or TDD Guard)?~~ | Resolved: layered, D-064 (skill, Stop hook, commit-shape check, spec-reviewer); red commits still allowed | Chat 7 |
| 4 | Does the schedule survive contact? | Checkpoint rules apply cuts automatically (4.2) | Checkpoints A and B |

## Sources

- Conventional Commits and commitlint with Husky v9 (`npx husky init`, `commit-msg` hook, config-conventional types including `test`, `feat`, `refactor`): https://commitlint.js.org/guides/local-setup
- GitHub protected branches (free for public repositories; required status checks; linear history requires squash or rebase merges): https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Render Blueprint spec (`plan: free`, `region` values and that region can't change after creation, `healthCheckPath`, `autoDeployTrigger` with `checksPass`, `sync: false` secrets): https://render.com/docs/blueprint-spec
- Render Node version selection (`NODE_VERSION`, `.node-version`, `.nvmrc`, `engines.node`; upper bound advised): https://render.com/docs/node-version
- Node.js releases (v24 "Krypton" and v22 LTS, v26 Current as of October 2026): https://nodejs.org/en/about/previous-releases
- Playwright web server config (`command`, `url`, `reuseExistingServer`): https://playwright.dev/docs/test-webserver

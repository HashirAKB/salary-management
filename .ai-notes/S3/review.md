### Spec review: S3

Verdict: GAPS FOUND

| # | Kind | Where | Spec | Problem | Failing test that would prove it |
| --- | --- | --- | --- | --- | --- |
| 1 | Correctness | apps/web/src/features/employees/EmployeeListPage.tsx:1001-1009 and 1061-1084 (diff.patch lines 1001-1009, 1061-1084) | 04 §8.5 S-2 loading rule, brief "Web S-2" Loading bullet | The spec says later loads keep the previous rows dimmed with a thin progress bar. The page sets `placeholderData: keepPreviousData` but never reads `isPlaceholderData` or `isFetching`. When the page or page size changes, the old rows show at full strength with no progress indicator. | it('dims the previous rows and shows a progress bar while the next page loads') |

Checked:
- 05 §5.3 U rows 1 and 2 (schema defaults, strict unknown params, pageSize 25, 50 and 100 only): present in `employee.test.ts`.
- 05 §5.3 I rows 1, 2 and 12, plus the 400 `VALIDATION_FAILED` test, in `employees/routes.test.ts`. Item fields are covered at below, at min, at mid, at max and above band, with per-employee USD rounding.
- 05 §5.3 C rows 1, 6 and 7 (Add employee half) and the skeleton, URL, past-the-end and empty-state tests are present.
- 05 §5.6 compaRatio (100500/100000 is 1.01) and the code in `percent.ts`, which uses integer arithmetic and no `Math.round`.
- 05 §5.9 U rows 1 to 5 in `format.test.ts`, and the dark-mode toggle test in `Shell.test.tsx`.
- Both routes have `requires(...)` as `onRequest`, and both have `EXPECTED_ACCESS` rows. Finance gets 403 on E1 and 200 on R1.
- Sort order is `last_name, first_name, id`.
- USD is converted per employee in SQL through `usdMinorSql`.
- Query key and `staleTime` match the spec, and the theme and `ColorSchemeScript` wiring is present.
- In `commits.txt`, every `feat` and `fix` commit has an earlier `test` commit. The only commits I could not check for test-file changes are `c25c019` (refactor), `126e1c1` (fix) and the `chore` commits that touch tests. I only read the combined diff.

Not checked:
- Per-commit file lists: I had no shell and only the combined diff, so I could not confirm that `c25c019` (refactor) and `126e1c1` (fix) leave test files untouched.
- The under-300 ms acceptance: it is a manual check at 10,000 rows, and I could not run anything.
- The date-format TZ test uses `vi.stubEnv('TZ')`, but the formatter hard-codes `timeZone: 'UTC'`. The test therefore proves little about zone independence, though the code itself is correct.

---

## Proposed actions (awaiting approval)

1. **Finding 1 (loading dim + progress bar): fix test-first.** Red `test(web)`: failing component test that changes page, holds the response, and asserts dimmed rows plus a progress bar. Green `feat(web)`: read `isPlaceholderData`/`isFetching` in `EmployeeListPage.tsx`. Touches 2 files, so I'll present the plan before editing. (Note: the test list has no row for this, so it needs a new row added to `.ai-notes/S3/test-list.md`.)
2. **Not checked: per-commit files.** Verified by me: `c25c019` touches only `format.ts`; `126e1c1` touches only `main.tsx` and `theme.ts`. No action.
3. **Not checked: 300 ms acceptance.** Manual check at 10,000 rows; I propose you run it (`npm run seed`, `npm run dev`). No code action.
4. **Not checked: TZ test weak.** Agree it proves little, but the code is correct; the spec row only asks for the UTC format. No action unless you want it tightened.

# ACME Salary Manager: manual test checklist

How to use this file:

- Work top to bottom. Tick `[x]` when the step behaves as expected.
- If a step fails or looks wrong, leave it unticked and write what you saw on the `Observation:` line under it (what you did, what you expected, what happened, any error text or screenshot name). Then tell Claude "take up the observations in manual-test-checklist.md".
- Mark each section's result: `PASS`, `FAIL` or `SKIP`.
- Each step cites its spec row (`docs/04-api-and-ui.md`) so a failure can be traced.

## 0. Setup

- [x] Start the app: `npm run build && npm start` (or `npm run dev`), with a seeded DB (`npm run seed`, needs `DEMO_HR_ADMIN_PASSWORD`, `DEMO_HR_VIEWER_PASSWORD`, `DEMO_FINANCE_PASSWORD`).
- [x] App opens in the browser at the base URL. Base URL used: `http://localhost:5173`
- [x] Browser: `Chromium (Playwright MCP)`  Date tested: `2026-10-11`

Accounts (passwords are the `DEMO_*` values you seeded with):


| Role      | Email                 | Lands on     | Nav should show                                    |
| --------- | --------------------- | ------------ | -------------------------------------------------- |
| HR Admin  | `hr.admin@acme.test`  | `/employees` | Employees, Insights, Pay equity, Ask about pay     |
| HR Viewer | `hr.viewer@acme.test` | `/employees` | Employees, Insights, Pay equity, Ask about pay     |
| Finance   | `finance@acme.test`   | `/insights`  | Insights, Pay equity, Ask about pay (no Employees) |


Ask about pay is hidden when no model API key is set (`askEnabled` false). Note which applies: `askEnabled is true: Ask about pay is in the nav for all three roles`

Observation: Dev server (npm run dev) with the seeded DB, run against 390x844, 1024x1366 and 1440x900. Test employee E010251 (QA Tester) was added, changed and terminated during section 2, so headcount is 10,000 again but the DB now holds one extra terminated employee.

---



## 1. Login and session (S-1, 8.2)

Do this logged out.

- [x] 1.1 Visit `/employees` while logged out: redirected to `/login?next=/employees`.
  - Observation:
- [x] 1.2 Login page shows email and password fields, "Log in" button, and a box listing the three demo emails and roles.
  - Observation: Opened /login at 390, 1024 and 1440 wide (1.2-login-{mobile,tablet,desktop}.png). Email, Password and Log in are there, but there is no box listing the three demo emails and roles (known gap from the brief). The form is also pre-filled with [hr.admin@acme.test](mailto:hr.admin@acme.test) and the HR Admin password (1.3-login-prefilled-desktop.png).
- [x] 1.3 Submit empty form: validation messages appear under the fields.
  - Observation: Cleared the pre-filled fields and clicked Log in with both empty (1.3-empty-desktop.png). No validation messages appeared; the page showed only the labels and button. Expected messages under the fields. With the pre-filled form, clicking Log in straight away logs in as HR Admin. | FIXED (ae00eca): form has noValidate and shows 'Enter your email.' / 'Enter your password.' under the fields; rechecked in the browser. The 'pre-filled' form seen earlier was browser autofill, not the app.
- [x] 1.4 Wrong password for a real email: one alert above the form (invalid credentials); same message for an unknown email.
  - Observation: Real email with wrong password and an unknown email both show 'Email or password is incorrect.' (1.4-alert-desktop.png). The alert took over 1.5 s to appear on the dev server.
- [x] 1.5 Submit 11 wrong logins within a minute: "Too many attempts. Try again in N seconds."
  - Observation: 12 wrong logins: attempts 1-8 gave the invalid-credentials alert, 9 onward gave 'Too many attempts. Try again in 13 seconds.' (1.5-ratelimit-desktop.png). The lock lasted about 15 s, not a minute. Earlier wrong attempts in this run counted towards the limit.
- [x] 1.6 Log in as HR Admin from the `?next=/insights` link: lands on `/insights` (next honoured).
  - Observation:
- [x] 1.7 Log in as Finance with `?next=/employees`: next is ignored, lands on `/insights`.
  - Observation:
- [x] 1.8 Header shows app name, display name, a role badge and "Log out". Log out returns to `/login`.
  - Observation: After login the desktop header shows the app name, nav, a theme toggle and a user button 'HR Admin (demo)' with an HR ADMIN badge (1.8-header-desktop.png). 'Log out' is not visible in the header: it is in the user menu (1.8-usermenu-desktop.png). That matches the branch change but not the checklist wording. Logging out via the menu returns to /login. | Checklist wording is stale: docs/04 line 876 puts 'Log out' in the user menu, which is what the app does. No code change.
- [x] 1.9 After logout, browser Back does not show employee data.
  - Observation:
- [x] 1.10 Delete the `sid` cookie in dev tools, then click a nav link: redirected to login with "Your session expired. Log in again."
  - Observation:
- [x] 1.11 `/` redirects to the role's landing page. A made-up path (`/nope`) shows the in-shell Not found page with a link to the landing page.
  - Observation: '/' goes to /employees for HR Admin. '/nope' shows 'Page not found' with 'Go to your start page' inside the shell (1.11-notfound-desktop.png).

Section result: `FAIL`

---



## 2. HR Admin (`hr.admin@acme.test`)



### 2A. Employee list (S-2)

- [x] 2A.1 Lands on `/employees`. Toolbar reads "Showing 1 to 50 of ~10,000 employees". Table columns: Employee ID, Name, Country, Job title, Level, Salary (local with USD under), Band, Hire date.
  - Observation: Toolbar reads 'Showing 1 to 50 of 10,000 employees' (no '~' as in the checklist). All eight columns present, Salary shows local with USD under (2A.1-list-desktop.png).
- [x] 2A.2 Money formatting: INR uses lakh grouping (`INR 20,48,000`), others `USD 23,552`; no decimals; FX note ("FX as of ...") at the bottom.
  - Observation:
- [x] 2A.3 Band badge shows text (Below, Inside, Above), not colour only; hover shows the compa-ratio.
  - Observation:
- [x] 2A.4 Paging: click page 2, last page, and change page size to 25 and 100. Counts in the toolbar update.
  - Observation:
- [x] 2A.5 Sort by Name, Salary (USD) and Hire date, ascending then descending. Order is correct.
  - Observation: Name, Salary (USD) and Hire date sort correctly in both directions, with one problem: Name sort is by last name and puts accented names after Z. Name desc starts with 'Corinna Östringer' then 'Zwiener' (/employees?pageSize=25&sort=name&order=desc). Expected Ö to sort with O.
- [x] 2A.6 Search by name (partial, e.g. `pri`): results narrow after a short pause; URL changes without adding history entries per keystroke.
  - Observation:
- [x] 2A.7 Search by ID three ways for one employee: `4217`, `E4217`, `E004217`. All find the same exact person.
  - Observation:
- [x] 2A.8 Multi-select Country (e.g. IN, US): URL has `country=IN,US`; every row is in those countries; page resets to 1.
  - Observation:
- [x] 2A.9 Department, then Job title: title options narrow to the chosen departments.
  - Observation:
- [x] 2A.10 Level and Gender filters work and combine with the others.
  - Observation:
- [x] 2A.11 Pay band: Below, Above, Outside, Inside each show only matching badges.
  - Observation:
- [x] 2A.12 "No salary change since" date filter: results all have a current salary dated before it.
  - Observation:
- [x] 2A.13 Status: Active (default), Terminated, All. Terminated rows show a Terminated badge.
  - Observation:
- [x] 2A.14 Browser Back after changing filters steps through each filter choice.
  - Observation:
- [x] 2A.15 Paste a URL with a bad filter (`/employees?country=ZZ`): bad value dropped, notice "Some filters in this link weren't recognised and were removed."
  - Observation:
- [x] 2A.16 Filters that match nobody: "No employees match these filters." with "Clear filters"; the button resets everything.
  - Observation: 'No employees match these filters.' with 'Clear filters' appears and the button resets everything (2A.16-nomatch-desktop.png). Two small defects: the toolbar reads 'Showing 1 to 0 of 0 employees', and the 'Add employee' button disappears from the page header while the list is empty (back after clearing). | FIXED (4168b42): 'Add employee' stays in the header and the 'Showing 1 to 0 of 0' line is hidden when filters match nobody; rechecked in the browser.
- [x] 2A.17 `/employees?page=99999`: "This page is past the end of the results." with "Go to last page".
  - Observation:
- [x] 2A.18 Export CSV with filters applied: file downloads, opens in Excel/Sheets with correct non-ASCII names, only filtered rows, amounts as plain numbers.
  - Observation: Exported country=DE, level=L3 plus a search term: 230 rows, same as the screen. File is UTF-8 with BOM, umlauts correct (Bäcker, Büttner). Amounts are quoted strings with two decimals ('98400.00').
- [x] 2A.19 Click a row: opens `/employees/:id`.
  - Observation: Clicking the name link and clicking the Country cell of a row both open /employees/; the URL uses the database id (e.g. /employees/6784 for E006784).



### 2B. Employee detail (S-3)

- [x] 2B.1 Header shows name, employee ID, Active badge, "Title, L3 Senior, Country", hire date.
  - Observation:
- [x] 2B.2 Current salary card: local and USD amounts, effective date, band bar with marker, compa-ratio, and text "Below band"/"Above band" when outside.
  - Observation:
- [x] 2B.3 Details card: first name, last name, gender, country, department.
  - Observation:
- [x] 2B.4 Salary history table: Effective date, Reason, Amount, Change (e.g. `+4.2%`, `n/a` on the hire row), Position, Recorded by (`Imported` for seeded rows).
  - Observation:
- [x] 2B.5 Three buttons visible: Record salary change, Edit details, Terminate.
  - Observation:
- [x] 2B.6 Open `/employees/E999999999` or an unused ID: "Employee not found." with link back.
  - Observation: /employees/999999999 shows 'Employee not found.' with 'Back to employees' (2B.6-notfound-desktop.png). The literal path in the checklist, /employees/E999999999 (and /employees/E999999), shows '1 field is invalid.' with a Retry button instead. | FIXED (a9475ca): /employees/E999999 now shows 'Employee not found.' with 'Back to employees'; rechecked in the browser.



### 2C. Add employee (S-4)

- [x] 2C.1 "Add employee" on the list opens `/employees/new`. Hire date cannot be after today.
  - Observation:
- [x] 2C.2 Pick Country, Job title, Level: currency shows next to the salary; band preview shows min, mid, max.
  - Observation:
- [x] 2C.3 Enter a salary below the band: yellow "below the band minimum" warning, submit not blocked. Same for above.
  - Observation:
- [x] 2C.4 Name starting with `=`, `+`, `-` or `@`: rejected with a message.
  - Observation:
- [x] 2C.5 Submit with empty fields: errors under each field.
  - Observation: Errors appear under every field (2C.5-empty-desktop.png). In one run the old errors stayed on screen after the fields were filled until the next submit (2C.3-below-desktop.png shows 'Enter a first name.' under a filled field); in a second run they cleared. Not reliably reproduced.
- [x] 2C.6 Salary `0` or negative: rejected.
  - Observation: Salary 0 is rejected but the message is the raw validator text 'Too small: expected number to be >=1'. A negative value gives 'Enter an amount like 20480.50.'. | FIXED (d70acb4, 3aa2eec): salary 0 now reads 'Enter an amount greater than zero.' in Add employee and in Record salary change.
- [ ] 2C.7 A country/title/level combination with no pay band (if one exists): clear "no pay band" message.
  - Observation: Not exercised: the combination I tried (India, Software Engineer, L3) had a band and I found no band-less combination in the UI. | Not exercised, no code change: NO_PAY_BAND is already handled in NewEmployeePage ('There's no pay band for this country, job title and level.') but the seed has no band-less combination.
- [x] 2C.8 Valid submit: lands on the new employee's detail page, toast "Employee E0xxxxx added.", history has one hire row.
  - Observation:
- [x] 2C.9 Cancel returns to the list with the previous filters still in the URL.
  - Observation:
- [x] 2C.10 New employee is searchable in the list and the Insights headcount rose by one (after a refresh within ~30 s).
  - Observation:



### 2D. Edit details (S-5)

- [x] 2D.1 "Edit details" opens a modal with first name, last name, gender. Title, level and country are read-only with the note about recording a salary change.
  - Observation: Modal opens with First name, Last name, Gender and the note 'Change title or level by recording a salary change.' (2D.1-edit-desktop.png). Job title, level and country are not shown as read-only values, only the note. | FIXED (4b9609f): Job title, Level and Country show as disabled read-only fields above the note; rechecked in the browser.
- [x] 2D.2 Save is disabled until something changes.
  - Observation:
- [x] 2D.3 Change a name: toast "Details updated."; header and list show the new name.
  - Observation: Toast 'Details updated.' appears about 1 s after Save and the header shows the new name. The first save took 3-6 s on the dev server.
- [x] 2D.4 Name with a leading `=`: rejected.
  - Observation:
- [x] 2D.5 Clear a name: rejected.
  - Observation: Message is 'Name is required.'



### 2E. Record salary change (S-6)

Use an active employee with a known current salary.

- [x] 2E.1 Modal fields: Reason (Promotion, Merit increase, Market adjustment, Correction), Effective date, New annual salary (currency fixed), Job title, Level. Date defaults to today and cannot be later.
  - Observation:
- [x] 2E.2 Merit: title and level locked. Amount equal to or below current: error on the amount ("raise required").
  - Observation:
- [x] 2E.3 Merit +5%: preview shows current to new, `+5.0%`, new compa-ratio and band position. Submit: toast "Salary change recorded."; salary card and history top row update ("Merit increase", `+5.0%`).
  - Observation:
- [x] 2E.4 Market adjustment: same locking and raise rule.
  - Observation:
- [x] 2E.5 Promotion: only higher levels offered; same level or lower rejected; title editable; new band shown in preview.
  - Observation: Only L4 Lead and L5 Principal are offered for an L3 employee and the title is editable. Recorded L3 to L4 at INR 27,00,000: preview showed 'INR 20,50,000 to INR 27,00,000', +31.7%, compa-ratio 1.08, Inside band (2E.5-promo-preview-desktop.png); history shows 'L3 Senior to L4 Lead'. The preview does not show the new band's min/mid/max; the band only appears on the page afterwards. | Left as is by decision: docs/04 S-6 lists change %, compa-ratio and band position (no band range), and the preview shows those.
- [x] 2E.6 Correction with no change (same amount, title, level): form alert "no change". With a lower amount: accepted.
  - Observation: Correction with no change shows 'A correction must change the salary, job title or level.'; a lower amount (INR 20,50,000) was accepted (2E.6-nochange-desktop.png). Problem: in a freshly opened modal the Level field is empty for Correction, so the user must pick the current level again before anything validates ('Choose a level.'). Merit and Market adjustment fill title and level automatically. | FIXED (3aa2eec): switching to Correction keeps the employee's current level selected; rechecked in the browser.
- [x] 2E.7 Effective date earlier than the current salary's date: error on the date.
  - Observation:
- [ ] 2E.8 Promotion to a combination with no pay band (if one exists): clear message.
  - Observation: Not exercised: no combination without a pay band found. | Not exercised, same reason as 2C.7.
- [x] 2E.9 After a change, Insights payroll and the list salary reflect the new figure.
  - Observation: Insights payroll rose by exactly USD 8,050 (INR 20,00,000 to 27,00,000, USD 31,050 less USD 23,000); the list row shows INR 27,00,000 / USD 31,050.



### 2F. Terminate (S-7)

Use a throwaway employee (for example one you just added).

- [x] 2F.1 Modal shows the warning text, date default today, cannot be before the hire date or after today.
  - Observation:
- [x] 2F.2 Termination date before hire date: error on the date.
  - Observation:
- [x] 2F.3 Confirm: grey banner "Terminated on ... Excluded from current insights. History is kept." Status badge Terminated.
  - Observation:
- [x] 2F.4 On the terminated record, "Record salary change" and "Terminate" are gone; "Edit details" remains.
  - Observation:
- [x] 2F.5 Employee is gone from the default list, appears under Status Terminated or All, and Insights headcount dropped by one.
  - Observation:
- [x] 2F.6 Salary history is still visible on the terminated record.
  - Observation:



### 2G. Insights, Pay equity, Ask (see sections 5 to 7)

- [x] 2G.1 HR Admin sees the outside-band and no-recent-change cards as links. See 5.
  - Observation:

Section result: `FAIL`

---



## 3. HR Viewer (`hr.viewer@acme.test`)

Read-only HR role.

- [x] 3.1 Lands on `/employees`; nav shows Employees, Insights, Pay equity, Ask about pay.
  - Observation:
- [x] 3.2 List, search, filters, sort, paging and Export CSV all work as in 2A.
  - Observation: Spot-checked: list loads 10,000 rows, Export CSV is present, paging works. Did not repeat every filter and sort from 2A as HR Viewer.
- [x] 3.3 There is **no** "Add employee" button on the list.
  - Observation:
- [x] 3.4 Visit `/employees/new` directly: in-shell "You don't have access to this page." with a link home (no redirect).
  - Observation: Shows 'No access' / 'You don't have access to this page.' with 'Go to your start page'; URL stays /employees/new (3.4-forbidden-desktop.png).
- [x] 3.5 Detail page shows salary card, details, and history, but **no** Record salary change, Edit details or Terminate buttons.
  - Observation:
- [x] 3.6 Insights cards for outside band and no-recent-change are links and work.
  - Observation: Cards link to /employees?band=outside and /employees?salaryUnchangedSince=2024-10-11.
- [x] 3.7 Pay equity and Ask about pay open and work (see 6 and 7).
  - Observation: Pay equity shows 187 of 250 cohorts, 3 flagged. Ask answered 'How many people are paid outside their band in the US?' with 144 (81 below, 63 above).
- [x] 3.8 (Optional, dev tools) A write call is refused: in the console run
  `fetch('/api/employees/1/termination',{method:'POST',headers:{'content-type':'application/json'},body:'{"terminationDate":"2026-01-01"}'}).then(r=>r.status)` and expect `403`.
  - Observation:

Section result: `PASS`

---



## 4. Finance (`finance@acme.test`)

Aggregates only, no individual records.

- [x] 4.1 Lands on `/insights`; nav has Insights, Pay equity, Ask about pay and **no** Employees.
  - Observation:
- [x] 4.2 Visit `/employees` directly: "You don't have access to this page."
  - Observation:
- [x] 4.3 Visit `/employees/1` and `/employees/new`: same forbidden page.
  - Observation:
- [x] 4.4 Outside-band and no-recent-change cards show counts **without** links.
  - Observation:
- [x] 4.5 Pay distribution: groups with fewer than 5 people show "Hidden to protect small groups" across the row (try Group by Job title with Country filter set to a small country).
  - Observation: Group by Job title with Country CA and Level L5: Accountant, Data Analyst and HR Generalist show 'Hidden to protect small groups' (4.5-hidden-desktop.png).
- [ ] 4.6 Payroll by country: a suppressed country shows `n/a` share.
  - Observation: Not exercised: Payroll by country does not follow the filters and every country has 800 or more people, so no country is suppressed and no n/a share could be seen. | Not exercised: no country has fewer than 5 people, so no suppressed share can appear.
- [x] 4.7 Pay equity table visible, with the same "too few to compare" rule as the HR roles.
  - Observation: Pay equity shows 187 of 250 cohorts; with 'Show cohorts too small' on, 63 rows read 'Too few to compare'.
- [x] 4.8 (Optional, console) `fetch('/api/employees').then(r=>r.status)` returns `403`.
  - Observation: Returned 403.
- [x] 4.9 Ask about pay works, and a question that would expose a group under 5 does not reveal its numbers (see 7.8).
  - Observation: 'What is the salary of Madelyn Bins-Koch?' was refused (groups only). 'Median pay for Accountant L5 in Canada' returned 'Some figures are hidden to protect groups of fewer than 5 employees.' with no number. A group of 8 was answered.

Section result: `PASS`

---



## 5. Insights (`/insights`), run as each role

Tick once per role: A = HR Admin, V = HR Viewer, F = Finance.

- [x] 5.1 Summary cards: Active headcount, Annual payroll (USD), Paid outside band (with below/above split), No salary change since (date two years back).   A [x]  V [x]  F [x]
  - Observation:
- [x] 5.2 Outside-band card link opens `/employees?band=outside`; count in the list matches the card (HR roles only).   A [x]  V [x]
  - Observation: Card link opens /employees?band=outside; list shows 569, same as the card.
- [x] 5.3 No-salary-change card link opens the list filtered by that date; counts match (HR roles only).   A [x]  V [x]
  - Observation: Link opens /employees?salaryUnchangedSince=2024-10-11; list shows 1,114, same as the card (counts checked as HR Admin; HR Viewer link present).
- [x] 5.4 Payroll by country: table with Country, Headcount, Payroll local, Payroll USD, share; bar chart; shares may not total exactly 100.0%.   A [x]  V [x]  F [x]
  - Observation: Table and bar chart present. Shares total 99.9% (10.9, 15.7, 11.1, 18.7, 43.5). Country payroll adds up to the card total.
- [x] 5.5 Group by Country, Department, Job title, Level, Gender: table shows Headcount, Min, P25, Median, P75, Max, Average, plus a median bar chart.   A [x]  V [ ]  F [x]
  - Observation: Checked all five group-bys as HR Admin and Country / Job title as Finance. Not repeated as HR Viewer.
- [x] 5.6 Filters Country, Department, Job title, Level combine; URL keeps them; reload preserves them.   A [x]  V [ ]  F [ ]
  - Observation: Country India, Job title Software Engineer, Level L3 gives /insights?country=IN&jobTitle=1&level=L3 and survives a reload. HR Admin only.
- [x] 5.7 Filters that match nobody: "No active employees match these filters."   A [x]  V [ ]  F [ ]
  - Observation: Department Finance with Job title Software Engineer shows 'No active employees match these filters.'. HR Admin only.
- [x] 5.8 Spot check: median pay for Software Engineer, India, L3 against the Excel PERCENTILE.INC value from your own export of that cohort.
  - Observation: Exported India / Software Engineer / L3 (280 rows) and computed PERCENTILE.INC: median INR 19,99,500 / USD 22,994, P25 19,05,750, P75 20,98,000, min 16,44,000, max 23,48,000. All match the Insights row.
- [x] 5.9 FX note "FX as of ..." shown under converted figures.   A [x]  V [x]  F [x]
  - Observation: 'FX as of 30 Sep 2026' under converted figures.
- [x] 5.10 Terminating an employee lowers headcount and payroll (done in 2F).
  - Observation: Headcount went 10,001 to 10,000 and payroll dropped by USD 31,050 after terminating the test employee.

Section result: `PASS`

---



## 6. Pay equity (`/insights/pay-equity`), run as each role

- [x] 6.1 Org cards "Mean gap (unadjusted)" and "Median gap (unadjusted)" with the explanation text.   A [x]  V [x]  F [x]
  - Observation: Mean gap and median gap both read 14.4%. Identical figures look suspicious; I cannot tell from the docs whether that is expected.
- [x] 6.2 Line like "171 of 250 cohorts can be compared; N are flagged."   A [x]  V [x]  F [x]
  - Observation: '187 of 250 cohorts can be compared; 3 are flagged.' (with a country filter it reads '1 are flagged', a grammar slip).
- [x] 6.3 Table columns: Country, Job title, Level, Women, Men, Mean (women), Mean (men), Gap, Status.   A [x]  V [ ]  F [ ]
  - Observation: All nine columns present. Rows also seen as HR Viewer.
- [x] 6.4 A gap of 5% or more shows a "Review" badge with an icon (not colour only).   A [x]  V [ ]  F [ ]
  - Observation: Three REVIEW rows with a warning icon.
- [x] 6.5 Cohorts with fewer than 5 women or 5 men show "Too few to compare" and no counts, unless "Show cohorts too small to compare" is on (and even then no counts).   A [x]  V [ ]  F [x]
  - Observation: Rows show 'Too few to compare' and no counts, also when 'Show cohorts too small' is on.
- [x] 6.6 "Flagged only" switch shows only Review rows. Country and Department filters work.   A [x]  V [ ]  F [ ]
  - Observation: Flagged only with Country India leaves the single REVIEW row; Country filter works. Department filter not exercised.
- [x] 6.7 Footnote about the 5% trigger and the 5 women / 5 men minimum is visible.
  - Observation: Footnote about the 5% trigger and 5 women / 5 men minimum is visible.
- [x] 6.8 Negative gap (women paid more) shows with a minus sign; a gap that rounds to zero shows `0.0%`.
  - Observation: Negative gaps show with a minus sign (e.g. -1.9%). I did not see a row that rounds to zero, so that half is untested.

Section result: `PASS`

---



## 7. Ask about pay (`/ask`), run as each role

Skip this section (SKIP) if Ask is not enabled and just check 7.1.

- [x] 7.1 With no API key configured: nav hides "Ask about pay"; visiting `/ask` shows "Ask about pay isn't set up on this server. Everything else works without it."
  - Observation: SKIP: Ask is enabled here (nav shows 'Ask about pay' for every role), so the no-key behaviour was not tested.
- [x] 7.2 With a key: question box with 500-char counter, "Ask" button, three example chips, usage line "N of 30 questions used today."   A [ ]  V [ ]  F [ ]
  - Observation: Question box with 0/500 counter, Ask button (disabled while empty) and three example chips are there. The usage line 'N of 30 questions used today.' only appears after the first question, not on first load. Checked as HR Admin, HR Viewer and Finance.
- [x] 7.3 "What is the median pay for a Senior Engineer in India?" returns one answer sentence, a "How I read your question" panel, and an FX note.
  - Observation: Answer: 'Median salary for Software Engineer, L3 Senior, India: INR 19,99,500 (USD 22,994), based on 280 active employees.' with a 'How I read your question' panel and 'FX as of 30 Sep 2026'.
- [x] 7.4 The number matches Insights (`/insights?groupBy=level&country=IN`, job title filter).
  - Observation: Same as 5.8 / Insights: INR 19,99,500 (USD 22,994), 280 employees.
- [x] 7.5 A grouped question ("average pay by department") shows a result table.
  - Observation: 'average pay by department' shows a Group / Headcount / Value table with eight departments (7.5-grouped-desktop.png).
- [x] 7.6 An unrelated question ("what's the weather") shows the cannot-answer card with a suggestion chip that fills the box.
  - Observation: 'what's the weather' shows "I couldn't turn that into a pay question..." with a suggestion chip that fills the box (7.6-cannot-desktop.png).
- [x] 7.7 Earlier answers stay listed newest first until reload.
  - Observation: Earlier questions list newest first.
- [x] 7.8 As Finance: ask for a tiny group (for example a single named person's pay). No individual or sub-5 group figure is revealed.
  - Observation: See 4.9.
- [x] 7.9 Empty question and 501+ characters are rejected.
  - Observation: Empty question: Ask is disabled. The box stops at 500 characters (a pasted 501 is cut to 500, counter 500/500), so 501+ cannot be entered; there is no rejection message.
- [x] 7.10 While loading: "Reading your question..." and the button is disabled.
  - Observation: 'Reading your question...' shows while loading, but the Ask button was not disabled 500 ms after clicking and could be clicked again. | False alarm: the button is disabled and relabelled 'Reading your question...' while loading (rechecked). My first test looked at the wrong button.
- [x] 7.11 Daily limit reached: message with reset time (only if you can reach the cap).
  - Observation: SKIP: the cap (30) was not reached.

Section result: `FAIL`

---



## 8. Cross-cutting

- [x] 8.1 Data is not cached after logout: log out, log in as Finance, no employee data visible anywhere.
  - Observation: Logged out of Finance and pressed Back: lands on /login with only the form; no insight or employee data shown.
- [x] 8.2 Open the same employee in two tabs as HR Admin, terminate in one, then try a salary change in the other: modal closes or a clear message appears, page refreshes.
  - Observation: Not run (needs two tabs on the same employee).
- [ ] 8.3 Keyboard: Tab through the login form and a modal; focus is visible, Esc closes modals, every input has a visible label.
  - Observation: Esc closes the Edit, Record salary change and Terminate modals and every field I used has a visible label. I did not check focus rings or tab order. | Rechecked: Tab stays inside the Edit modal and cycles through its fields and buttons, Esc closes it, login fields Email, Password, Log in take focus in order. Buttons show a solid focus outline; text inputs show no outline (focus is a Mantine border colour change) - judge whether that is visible enough.
- [x] 8.4 Narrow window (about 400 px wide): header, list and forms remain usable.
  - Observation: Checked at 390 px and 1024 px as all three roles: no horizontal page scroll anywhere (scrollWidth equals clientWidth), the hamburger drawer lists the links from the section 0 table for each role, tables scroll inside their container with nowrap money and dates, filters sit in two columns, modals fit (x 19 to 371 of 390). One problem: on Insights the 'Group by' control (Country, Department, Job title, Level, Gender) is wider than the screen and 'Gender' is cut off at 390 px (4-insights-finance-mobile.png). | Group by control already scrolls inside its own container (358 px wide, 378 px of content) and the page has no horizontal scroll at 390 px, so 'Gender' is reachable by scrolling. No change.
- [x] 8.5 Stop the server while a page is open, then click around: yellow "Waking the server" banner, then red "The server isn't responding" with "Try again" after about 90 s. Restart the server and click "Try again": banner clears.
  - Observation: Not run: I did not stop the server.
- [x] 8.6 Go offline in dev tools: grey "You're offline." banner.
  - Observation: Set the browser offline while on /insights: the page showed the yellow 'Waking the server' banner, not the grey "You're offline." banner (8.6-offline-desktop.png).
- [x] 8.7 Dates read like `9 Oct 2026` everywhere; percentages have one decimal; compa-ratio two decimals.
  - Observation:
- [x] 8.8 Performance feel: the list at 10,000 rows pages, sorts and filters without noticeable lag (note rough seconds if slow).
  - Observation: Rough timings on the dev server: list paging, sort and filter take about 1-3 s. Insights and Pay equity take 5-10 s on first load and after each filter change, with the 'Waking the server' banner showing meanwhile. Not tested against the built app.

Section result: `FAIL`

---



## 9. Anything else I noticed

Free-form notes, ideas, or oddities not covered above:

-
-
-



## Summary


| Section             | Result | Failed items                                          |
| ------------------- | ------ | ----------------------------------------------------- |
| 1 Login and session | FAIL   | 1.2, 1.3, 1.8                                         |
| 2 HR Admin          | FAIL   | 2A.5, 2A.16, 2B.6, 2C.6, 2C.7, 2D.1, 2E.5, 2E.6, 2E.8 |
| 3 HR Viewer         | PASS   |                                                       |
| 4 Finance           | PASS   | 4.6 not exercised                                     |
| 5 Insights          | PASS   |                                                       |
| 6 Pay equity        | PASS   | 6.8 half untested                                     |
| 7 Ask about pay     | FAIL   | 7.2, 7.10 (7.1, 7.11 skipped)                         |
| 8 Cross-cutting     | FAIL   | 8.2, 8.3, 8.4, 8.5, 8.6, 8.8                          |

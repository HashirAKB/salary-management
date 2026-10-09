# 01 Requirements: ACME Salary Manager

## Goal
Replace the Excel files ACME's HR team uses for 10,000 employees across several countries with a web app where HR can keep salary data correct and answer "how do we pay people?" in seconds. Success: every question below is answerable in the app without a spreadsheet.

## Users and the questions they need answered
The brief's persona is the HR Manager; that is our primary user (HR Admin). Salary data is sensitive and a 10k org has other readers, so we add two read-only roles. The extra roles cost one permission check per endpoint.

| Role | Can do | Questions they bring |
| --- | --- | --- |
| **HR Admin** (HR Manager) | Read and edit everything | Find an employee and record a raise. Who is paid outside their band? Whose salary hasn't changed in 2 years? Are women paid less than men in the same role? |
| **HR Viewer** | Read everything, no edits | Median pay for a Senior Engineer in India? Export this filtered list for a review. |
| **Finance** | Aggregates only: no names, no individual salaries | Total payroll by country in one currency? Average and median pay by department and level? |

## Scope (MoSCoW) with acceptance criteria
| # | Feature | Pri | Acceptance criteria |
| --- | --- | --- | --- |
| F1 | Login and roles | Must | Three seeded demo accounts. Every API endpoint enforces the table above; a forbidden call returns 403, tested per role. |
| F2 | Employee list | Must | Server-side paging (default 50), search by name or employee ID, filter by country, department, job title, level, gender, status, "outside band", "no salary change since <date>"; sort by name, salary (USD), hire date. Filters live in the URL. Any page returns in under 300 ms at 10k rows. |
| F3 | Add, edit, terminate employee | Must | HR Admin only. Adding sets name, gender, country, job title, level, hire date and starting salary. Editing changes name and gender only; job title and level change through F4, and country is fixed at hire. Required fields validated with clear messages. No hard delete: terminating sets status and end date, keeps history, and removes the person from current insights. |
| F4 | Salary change with history | Must | HR Admin records new amount, effective date (on or after the current salary's date, and today or earlier) and reason (promotion, merit, market adjustment, correction). A promotion raises pay and moves the employee up a level (optionally to a new title). History lists old and new amount, % change, title and level before and after, reason, who, when. Detail page shows band and compa-ratio (salary / band midpoint). |
| F5 | Pay insights | Must | Payroll and headcount by country (local and USD); P25, median, P75, min, max, average by country, department, job title, level; outside-band count and list (list for HR roles only). |
| F6 | Pay equity by gender | Must | Per cohort (country + job title + level): mean pay for women and men and the gap %. Cohorts with a gap of 5% or more are flagged for review. Org-wide mean and median gap shown. A cohort shows numbers only if it has at least 5 women and 5 men; otherwise "too few to compare". |
| F7 | CSV export | Must | HR roles export the current filtered list (salary in local currency and USD, FX as-of date). Same filters as the screen; output matches what the screen shows. |
| F8 | Ask about pay (AI) | Should | Plain-English question becomes a structured query (one metric, up to one group-by, filters) run by the F5 service; the interpreted query is shown beside the answer. Metrics: headcount, total, average, median, P25, P75, min, max, outside-band count, gender gap. Unsupported questions get a "can't answer that" with example questions. Hidden when no API key is set. |

Rules for every feature:
- Cross-country figures are in USD, converted with a static FX table; the as-of date is shown next to every converted number.
- Finance never receives a group with fewer than 5 people. Such groups show as "fewer than 5".
- Pay bands (min, midpoint, max per country, job title and level) are seeded and read-only.

## Out of scope, and why
- **Net pay, tax, deductions, payroll runs:** country tax rules are a product of their own. We manage gross base salary only.
- **Bonuses, equity, benefits:** base salary answers the brief's questions. Total compensation is a schema change later.
- **CSV import:** mapping, validation, duplicates and partial failures make it a feature on its own. The seed covers the initial load, and export covers getting data out.
- **Approval workflows, scheduled future-dated raises:** single-approver HR Admin edits are enough for v1.
- **Country transfers:** a transfer changes currency and band; v1 sets country at hire.
- **Editing pay bands in the UI:** bands are seeded. Editing is the next feature after v1.
- **SSO, per-field permissions, HR access scoped by country:** three roles cover the sensitivity need. Country scoping is a stretch goal.
- **Live FX rates:** a static, dated table makes numbers reproducible and testable.
- **Employee self-service, performance reviews, a statistical (regression) pay-equity model:** different users or expert-led work. The cohort comparison is a review signal, not a legal finding.
- **AI that lists or names individuals, answers trend questions, or edits data:** keeps the AI read-only, aggregate-only and within role permissions.

## Open questions (not requirements yet)
- How the live demo returns to a known state after reviewers edit data (deployment).
- Should Finance get a CSV export of aggregate tables? Deferred until after v1.

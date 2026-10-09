# 00 Brief analysis

Chat 0 output. Turns the brief into a scoring rubric, maps every line of it to an artifact and an owner chat, and lists the hidden expectations and open questions.
Inputs: `assessment-brief.md`, `decisions.md`, `chat-plan.md`, `company-context.md`.
Repo note (D-020): only sections 1 and 2 go into the repo as `docs/00-brief-analysis.md`. Sections 3 to 5 stay in the Project.

## 1. Scoring rubric (our reading of how this will be graded)

The brief does not publish weights. These are inferred from the "How to Succeed" list, Incubyte's job posts (test-first, small releases, ownership from design to deployment), and generic take-home scorecards. They tell us where to spend time, not what the grader literally uses.

| # | Criterion | Weight (our guess) | What 5/5 looks like | Evidence the grader sees |
| --- | --- | --- | --- | --- |
| R1 | Test-first discipline and commit history | High | Red, green, refactor visible per slice; small commits spread over real working time; never squashed | `git log --oneline`, commit timestamps, test files landing before code |
| R2 | Product thinking | High | Features traced to HR and Finance questions; out-of-scope list with reasons; insights answer real pay questions | `01-requirements.md`, the insights screens, the demo |
| R3 | Engineering judgment | High | Simple monolith, fast at 10k with measured numbers, each choice recorded with rejected alternatives | ADRs, `docs/performance.md`, README |
| R4 | Code quality and tests | High | Readable layers, domain logic testable without HTTP, behaviour-named tests, fast suite with no network | Source tree, test output, CI run |
| R5 | Intentional AI use | Medium-high | AI steered by specs, plan mode and a reviewer; places where the AI was overridden are written down; the AI feature is safe by design | `.ai-notes/` committed at end, `claude-code-kit/`, D-003 design |
| R6 | Works end to end | Gate | Live link loads, login works, edits persist, video shows the full flow | Live URL, video |
| R7 | Clear communication | Medium | README a stranger can follow in 5 minutes; docs short and linked | README, `docs/` |

R6 is a gate: a broken link or a README that does not run likely ends the review before R1 to R5 are read.

## 2. Traceability: every brief line to an artifact and an owner

| Brief line (paraphrased) | Artifact(s) | Owner chat |
| --- | --- | --- |
| **Expectations** | | |
| Assess how you think, design and build in an AI-driven environment | `docs/00`-`06`, ADRs, `.ai-notes/` (prompts and usage log) | 0-7, 9 |
| Required to use AI tools; we care how | `claude-code-kit/`, AI usage log with "where I overrode the AI" entries | 7, 9 |
| Clarity of thought, structured problem solving | This file, `01-requirements.md`, ADRs | 0, 1, 3 |
| Engineering fundamentals and product thinking | `01-requirements.md`, `03-architecture.md` | 1, 3 |
| Thoughtful architecture and design decisions | `03-architecture.md`, `adr/` (5-8 ADRs), C4 diagram | 3 |
| Production-quality code and tests | Source, `05-test-strategy.md`, CI | 5, build |
| Use AI intentionally while keeping correctness | spec-reviewer subagent, TDD enforcement, eval set for "Ask about pay" | 5, 7 |
| Incremental commits | Commit convention in `06-build-plan.md`; D-008 | 6 |
| **Goal** | | |
| Salary management software for 10,000 employees | Seed spec (`02`), server-side paging (`04`), `docs/performance.md` with numbers at 10k | 2, 4, 8 |
| **Persona** | | |
| HR Manager of the org | Personas in `01`; HR Manager maps to the HR Admin role (D-002) | 1 |
| **Problem statement** | | |
| 10,000 employees across multiple countries | Country and currency in the data model; static FX table with as-of date | 2 |
| Currently managed in Excel, tedious | Employee list, search, filter, edit; CSV export (D-014) | 1 |
| Manage salary data via web software | Add/edit employee, salary change with history | 1, 2, 4 |
| Answer questions about how the org pays people | Insights view; "Ask about pay" (D-003) | 1, 4 |
| **Requirements** | | |
| One-page requirements doc before building: goal, scope, features, left out and why | `docs/01-requirements.md`, committed before any code (D-008) | 1 |
| **Technical constraints** | | |
| Backend in the role's language/framework | D-001 (TypeScript, Node); framework ADR | 3 |
| Relational database such as SQLite | D-006 (libSQL); schema in `02` | 2, 3 |
| UI in React or Next.js | React + Vite (ADR) | 3 |
| Component library of your choice | ADR: Mantine or shadcn/ui | 3 |
| Seed script with 10,000 employees | Seed spec in `02`; slice S1 | 2, 6 |
| Fully functional deployed software | `08-deploy-perf-demo.md`; slice S9; C-003 | 8 |
| Video demo | Demo script in `08`; recorded Sunday | 8 |
| **Development approach** | | |
| Agentic AI tools, high code quality and coverage | `claude-code-kit/` | 7 |
| Meaningful unit tests for core functionality | Test lists per feature in `05` | 5 |
| Fast, deterministic, easy to understand tests | Rules in `05`: in-memory DB, fixed clock, seeded data, no network | 5 |
| Good structure, readability, maintainability | Layering in `03`; refactor commits | 3, build |
| Commits show evolution | `06` commit convention; never squash | 6 |
| **Artifacts** | | |
| Requirements document | `docs/01-requirements.md` | 1 |
| Planning or design notes | `docs/02`, `04`, `05`, `06` | 2, 4-6 |
| Architecture diagrams | C4 in `03`, ER diagram in `02` (Mermaid) | 2, 3 |
| Prompts or instructions used with AI | `.ai-notes/` committed at end (D-007), `claude-code-kit/` | 7, 9 |
| Trade-off explanations | ADRs; "Rejected alternatives" column in `decisions.md` | 3, all |
| Performance considerations | `docs/performance.md` with measured numbers | 8 |
| **Submission** | | |
| Code in a Git repository, commits show process, artifacts included | Repo on GitHub; submission checklist in `09` | 9 |
| Reply to the email with the repo link | Checklist item in `09` | 9 |

Every line has an owner. Nothing in the brief is unowned.

## 3. Hidden expectations (not written in the brief, but likely judged)

| # | Expectation | Why we think so | Owner |
| --- | --- | --- | --- |
| H1 | Insights are the core of the product, not a bonus | The problem statement ends with "answer questions about how the org pays people"; that is half the stated goal | 1 |
| H2 | Multi-currency is handled correctly | "Multiple countries" with no currency rule means comparing INR to USD naively is a visible bug | 2 |
| H3 | 10,000 rows are paged and filtered on the server, and it is fast | The number 10,000 is there to test scale judgment; loading all rows into the browser is the classic mistake | 4, 8 |
| H4 | Filter by country and job title, and salary aggregates (min, max, average) by country and by title, exist | An anonymous candidate review of an earlier Incubyte assignment describes employee-management questions filtering on country and title, and salary SQL questions in the technical round. Single source, different role, so low confidence, but cheap to cover | 1, 4 |
| H5 | Gross vs net salary may come up | The same review mentions gross and net salary. Net needs tax rules per country, which we leave out; the out-of-scope reason must be ready | 1 |
| H6 | The follow-up interview probes SQL and the data model | Same review; also the brief lists "relational database" explicitly | 2, 9 |
| H7 | The requirements doc predates the code in git | "Before building the software" is checkable from commit order | 6 |
| H8 | Commit timing looks human | Reviewers increasingly check whether all commits land in a tight window, since an agent can generate plausible commit loops | 6, 7 |
| H9 | A reviewer can run it locally in minutes | One-command setup, `.env.example`, works with no LLM key (D-004) | 3, 8 |
| H10 | Salary data is treated as sensitive | Access control (D-002), no secrets or real-looking passwords in the repo, demo passwords from env vars | 1, 3, 8 |
| H11 | The live demo survives reviewer edits | C-003; a reviewer may delete or corrupt data, so the live link needs a way back to a known state | 8 |
| H12 | Moving off Excel implies getting data in and out | Teams leaving spreadsheets want export at minimum; leaving import out needs a reason (D-014) | 1 |
| H13 | The UI suits a non-technical HR user | Persona is an HR manager: clear labels, formatted money, loading and empty states | 4 |

## 4. Risks and pushback

1. **Persona scope (D-002).** The brief names one persona, the HR Manager. We added HR Viewer and Finance. `01` justifies the extra roles in one line and keeps the HR Manager the primary user.
2. **Time.** About 11 slices plus deploy, video and docs in roughly two days is tight. The cut order in `chat-plan.md` should be applied by Saturday evening, not discovered on Sunday. Chat 6 should time-box each slice and put narrowing the AI ahead of anything touching pay equity.
3. **AI notes committed in one go (D-007).** To still show evolution, each log entry should carry the slice and commit hash it relates to. Suggestion for Chat 7.
4. **What of this file goes in the repo.** Resolved by D-020: sections 1 and 2 only.

## 5. Open questions

| # | Question | Status | Owner |
| --- | --- | --- | --- |
| Q1 | Commit all of this file to the repo? | Resolved: D-020 | - |
| Q2 | Recruiter notes: time budget? | Resolved: none given, deadline only | - |
| Q3 | Delete an employee, or terminate and keep history? | Resolved: D-016 | - |
| Q4 | Reporting currency for cross-country totals | Resolved: D-017 (USD) | - |
| Q5 | How the live demo returns to a known state after reviewer edits | Open | 8 |
| Q6 | Demo credentials published in the README? | Default yes; demo-only accounts, passwords set by env in the deployed instance | 8 |
| Q7 | Video host | Default: unlisted YouTube or Loom, linked from the README | 8 |

## Acceptance criteria for this file

- [x] Every line of the brief maps to an artifact and an owner chat (section 2).
- [x] Hidden expectations listed with the reason we believe each one (section 3).
- [x] Open questions listed separately from decisions, each with an owner and a default (section 5).

## Out of scope for this file

- Choosing features (Chat 1), schema (Chat 2), libraries (Chat 3), hosting details (Chat 8).

## Sources

- Incubyte Software Craftsperson job posts (test-first, small releases, ownership from design to deployment): https://jobgether.com/offer/6a50593bac00a71a5a8535c4-software-craftsperson-node.js-saas-reactjs---ii-sr. and https://jobgether.com/offer/6a7097f0e9f5b78658646f84-software-craftsperson-java-angular--ii
- Candidate interview reviews for Incubyte (assignment on employee filtering and gross/net salary; salary SQL in the technical round): https://www.glassdoor.com.mx/Entrevista/Incubyte-Entrevista-E3844202-RVW92151764.htm
- Take-home review scorecard (requirements skipped and why, tests, README): https://vcgjviylozysyxmjrfvr.supabase.co/storage/v1/object/public/templates/scorecard/take-home-review-scorecard.pdf
- Grader rubric that checks commit timing for incremental work: https://dev.to/lamingsrb/40-take-home-tests-graded-in-14-min-the-n8n-rubric-node-4agc

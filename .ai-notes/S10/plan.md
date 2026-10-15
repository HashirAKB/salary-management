# S10 plan (approved 2026-10-11)

Branch: s10-readme-demo (from main a09f1ea). Spec: brief.md. Checks: test-list.md. Decisions: overrides.md P1-P11.
Docs slice: no red/green pairs. Each step is one commit, proven by a check. Never stage .ai-notes/. Never --amend or force push.

## B1: clean-up and performance (/tdd-build S10 A-C)
A. Doc clean-up
   - git rm docs/00-brief-analysis.md docs/assessment-brief.md; drop the 00 mention in docs/02-data-model.md:4; mark D-020 superseded in docs/decisions.md (P6, P8)
     -> docs(docs): remove brief analysis and assessment brief
   - docs/08-deploy-perf-demo.md lines 86 and 88: em dash -> full stop
     -> docs(deploy): replace em dashes in the perf outline
   - CLAUDE.md: drop the `npm run e2e` line
     -> docs(docs): drop the e2e command from claude.md
   Check: git grep finds no reference to the removed files; no em dash in docs/.
B. scripts/perf.ts + npm "perf" script. Throwaway local file DB, seed 10,000; time the default list page, an insights request and the list sorted by USD (median and p95 over N runs); drop the 9 indexes and repeat. No new dependency.
     -> chore(db): add a query timing script for 10000 employees
C. docs/performance.md: measured numbers only, with machine, Node version and run count; the index on/off comparison against the 300 ms / 500 ms budgets; note the cache fallback was not needed (or why it was).
     -> docs(db): record query timings at 10000 employees

## B2: README (/tdd-build S10 D)
D. README.md, in this order: pitch, live link https://acme-salary-r5qq.onrender.com/ with the about-30 s cold-start note (P10), video placeholder, three demo accounts with passwords (P11, ask the user for the values); five-minute setup (nvm use, npm ci, cp .env.example .env, npm run seed, npm run dev); what it does for HR and Finance; how it works (links to docs/01-08 and ADRs, money rules, measured performance); how I worked with AI (spec first, plan mode, red/green commits enforced by hooks, spec-reviewer, recorded overrides, Ask eval set, links to .ai-notes/); how to read the history (git log --oneline --graph, one merge per slice); "Not built" (cut 3, Playwright smoke, with its 06 §4.1 cost).
   Show the full draft to the user before committing.
     -> docs: add readme with setup, demo accounts and design links
   Same session: draft the S8 and S9 entries in .ai-notes/log.md for user review (not staged).

## B3: demo video (/tdd-build S10 E-F)
E. talkies workspace ../salary-management-demo (P2), baseUrl http://localhost:5173, envFile ../salary-management/.env (never print it). talkies check --fix. Nine scenes from brief §"08 §7" (P1 local, P3 Ask required). Show the narration lines to the user before any voice is generated. npm run seed -> silent take (--no-voice) -> read sheet.png -> npm run seed -> talkies take --verify. Target 3 to 5 min.
F. The user uploads final.mp4 to a GitHub comment (user-attachments URL) and to YouTube as the fallback (P4). Embed the video and link the fallback in the README.
     -> docs: link the demo video

## R: finish (/tdd-finish S10)
npm run lint, typecheck, npm test, test:coverage; check every README link; grep README.md and docs/ for em dashes; fresh clone in the scratchpad following only the README reaches a running app with about 10,000 employees; live URL loads and HR Admin login works. Leave .ai-notes/ unstaged: the user commits it by hand, leaving out the PDF and the S*/diff.patch files and deciding on S10/prompt.md (P9).

## Acceptance -> proof
- A fresh clone following the README runs with seeded data -> fresh clone check in R
- Every README link works -> link check in R
- No em dashes in the README or docs -> grep in R (after A)
- Real performance numbers -> B/C script output pasted into the session
- Video is 3 to 5 min and linked -> E sheet.png and length; F

# S10 overrides

## P1. Video recorded locally, not from the live URL
- What I proposed: record from the live URL after a Turso reset (08 §7, "Record from the live URL after a fresh §4 reset").
- What you said: option b, record against local `npm run dev` after `npm run seed`.
- What changed: the talkies baseUrl is the local dev server and the reset before each take is a local `npm run seed`. The README still links the live URL.

## P2. talkies workspace outside the repo
- What I proposed: commit `demo/` (talkies.json and scenes) into the repo.
- What you said: option b, keep it in a sibling folder outside the repo (the skill default).
- What changed: no demo files are committed. The only video commit is `docs: link the demo video`.

## P3. Ask included in the video
- What you said: GEMINI_API_KEY is set on Render and in the local .env; include Ask.
- What changed: 08 §7 step 8 becomes a required scene.

## P4. Video hosting
- What you said: option a, a GitHub-uploaded MP4 embedded in the README, with a YouTube link as fallback.

## P5. Performance script committed
- What you said: option a, commit `scripts/perf.ts` (`chore(db)`) and measure with and without the indexes on a throwaway local DB.

## P6. Brief docs removed rather than trimmed
- What I proposed: keep only sections 1 and 2 of `docs/00-brief-analysis.md` (D-020, 06 S10 scope).
- What you said: remove the whole of `docs/00-brief-analysis.md` and `docs/assessment-brief.md` from the repo. Remove the 2 em dashes from `docs/08-deploy-perf-demo.md`. Remove the `npm run e2e` line from CLAUDE.md.
- What changed: both files are deleted with `git rm` (pending: whether "from git" means a history rewrite). 08 lines 86 and 88 lose the em dash. CLAUDE.md drops the e2e command.

## P7. Deletion without history rewrite
- What you said: A-a. `git rm` docs/00-brief-analysis.md and docs/assessment-brief.md in one docs commit; no history rewrite.

## P8. Dangling mentions cleaned
- What you said: B-b. Remove the `00-brief-analysis.md` mention from docs/02-data-model.md line 4; mark D-020 in docs/decisions.md as superseded (both files removed from the repo on 2026-10-11).

## P9. .ai-notes review
- What you said: take my recommendations (leave out the assessment PDF and S*/diff.patch; I draft S8 and S9 log.md entries for your review). NEVER commit .ai-notes/ myself; you commit it by hand.
- S10/prompt.md: left for you to decide at your hand commit (keep, trim or leave out).

## P10. Cold start measured
- What I wrote: no number, use 08 §3 "up to about a minute".
- What you said: cold start takes only 30 s.
- What changed: the README says the first load after idle takes about 30 seconds.

## P11. Demo passwords public
- What you said: Q1-a. Print all three demo account passwords in the README.

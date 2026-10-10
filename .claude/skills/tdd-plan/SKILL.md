---
name: tdd-plan
description: Plan one slice of docs/06-build-plan.md — branch, brief, test list, cycle grouping — then wait for approval. Run this once per slice in a fresh Opus session before any build sessions. Invoke as /tdd-plan S<n> [notes].
disable-model-invocation: true
argument-hint: "S<n> [notes for this slice]"
---

# Plan slice $0

You are planning slice **$0** from `docs/06-build-plan.md`. This session only plans — no production code, no test code. The build happens in separate `/tdd-build` sessions. State is stored in files and git; the next session reads the files you write here.

My notes for this slice (may be empty): $ARGUMENTS

## Rules
1. A gap or contradiction in the docs: stop. Start your reply with `BLOCKED:`, quote the doc section, list the options, and wait. Don't pick one yourself. Don't edit `docs/`.
2. When I correct something, append it to `.ai-notes/$0/overrides.md`: what you did, what I said, what changed.
3. Stage explicit paths. Nothing in `.ai-notes/` is ever staged.

## 0. Set up
1. Save my invocation verbatim to `.ai-notes/$0/prompt.md`. Do this first.
2. `git status` — tree must be clean. If on `main`, create the slice branch `s<n>-<slug>` (e.g. `s3-employee-list`). If on another slice branch, `BLOCKED:`.
3. Read only: the `### $0` section of `docs/06-build-plan.md`; every `docs/05-test-strategy.md` row it cites; every `docs/04-api-and-ui.md` and ADR section its **Docs** line lists; `docs/02-data-model.md` §4 if the slice touches money. Read nothing else.

## 1. Write brief.md
Write `.ai-notes/$0/brief.md` — at most about 4 KB, verbatim excerpts only, with section references:
- Every endpoint: method, path, status codes, problem codes, query params, request and response shapes (exact field names from 04).
- The role table rows that apply to this slice's routes (who can do what).
- Money and formatting rules that apply (02 §4, 04 §8.4).
- The 05 test rows this slice owns, copied verbatim.
- The ADR decision IDs and the one-sentence ruling that matters for this slice.

The brief is the only spec source for `/tdd-build` sessions. If it is silent, they stop with `BLOCKED:`. Be complete but not padded.

## 2. Write test-list.md
Write `.ai-notes/$0/test-list.md`: one line per test:
```
[ ] U  name as the it(...) will read  (05 §5.3 I row 1)
```
Levels: U unit, I integration, C component/e2e.

## 3. Cycle groups and plan
Group the tests into cycles of 1–4 related tests in build order. Then split cycles into sessions:
- **B1**: cycles A–C (roughly 3–4 cycles; adjust so each session is ≤ 35 calls).
- **B2**: cycles D–F (and so on).
- **R**: finish (lint, coverage, review) — always its own session.

For each cycle: files to touch, red commit subject `test(scope): …`, green commit subject `feat(scope): …` or `fix(scope): …`. Steps with no behaviour get one `chore`/`build`/`ci` commit.

For each acceptance criterion of the slice, name the test or check that proves it. Flag any with no proof.

## 4. Wait
Present the brief, test list and cycle plan. Stop and wait for approval. Do not write any code. After approval, record the approved plan in `.ai-notes/$0/plan.md` and end the session. The build starts in a fresh `/tdd-build` session.

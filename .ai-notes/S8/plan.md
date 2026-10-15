# S8 plan: Ask about pay (branch s8-ask-about-pay)

Spec source for build sessions: `brief.md` (includes the four gap rulings). Tests: `test-list.md`.

## Sessions
- B1: cycles A, B, C (pure: shared schema, tool schema, interpret checks, engine genderGap, templates)
- B2: cycles D, E, F (SDK, interpreter, endpoint, caps)
- B3: cycles G, H (web page, eval runner)
- R: `/tdd-finish S8`

## Cycles
A. Structured query and tool schema
   Files: `packages/shared/src/schemas/ask.ts` (StructuredQuery, AskBody, response schemas; export from index), `apps/api/src/modules/ask/tool-schema.ts`.
   Red `test(ask): keep the tool schema and zod schema in agreement`. Green `feat(ask): build strict tool schemas from reference data`.
B. Semantic rule and engine gender gap
   Files: `apps/api/src/modules/ask/interpret.ts` (parse, normalise enums, gender rule, resolve names to PayFilters), `apps/api/src/domain/pay-query.ts` (`genderGap` metric, `gap` in GroupResult).
   Red `test(ask): normalise enum casing and reject gender gap by gender`. Green `feat(ask): parse and check interpreted queries`.
C. Answer templates
   Files: `apps/api/src/modules/ask/answer.ts` (sentence, interpretation list, reason messages, gender-rule suggestion).
   Red `test(ask): write answers and refusals from templates`. Green `feat(ask): add answer templates`.
D. Anthropic interpreter
   `build(api): add @anthropic-ai/sdk 0.133.0` (exact pin, ADR 0008).
   Files: `apps/api/src/modules/ask/interpreter.ts` (QueryInterpreter, InterpretResult with token counts), `anthropic-interpreter.ts` (client injected), `system-prompt.ts` (04 §7.3 verbatim), `fake-interpreter.ts`.
   Red `test(ask): send strict tools and map stop reasons in the anthropic interpreter`. Green `feat(ask): add anthropic interpreter`.
E. Ask endpoint
   `chore(ask): add eval set` first: `apps/api/evals/ask-eval.json` (15 cases, 05 §6.3); FakeInterpreter map built from it plus one Finance-suppressed entry (05 §6.1).
   Files: `apps/api/src/modules/ask/{routes,service,repo}.ts`, app wiring (interpreter injected; Anthropic only when key set), `access-matrix.test.ts` row `POST /api/ask` → `ask.use`.
   Red `test(ask): return 503 without a key and answer with the fake interpreter`. Green `feat(ask): add ask endpoint`.
F. Caps and Finance
   Files: `modules/ask/repo.ts` (count today's rows by user and global), `service.ts` (Retry-After to UTC midnight from the clock).
   Red `test(ask): enforce per-user and global daily caps`. Green `feat(ask): add daily caps from the ask log`.
G. Ask page
   Files: `apps/web/src/features/ask/{api.ts,AskPage.tsx,AskPage.test.tsx}`, `Shell.tsx` nav entry, router `/ask`.
   Red `test(web): show answers, interpretation and refusals`. Green `feat(web): add ask page`.
H. Eval runner
   `chore(ask): add eval runner`: `apps/api/evals/run.ts`, root `npm run eval` script; writes `docs/evals/ask-eval-YYYY-MM-DD.md`.
   Manual, by the user with a key: `npm run eval`, then `docs(ask): record first eval run`.

## Acceptance proof
- No key: app works, Ask hidden → E "503 ASK_UNAVAILABLE, no log row"; S2 "me askEnabled false"; G "hides Ask about pay in the nav", "direct visit shows not-set-up message".
- With a key the live demo answers q01 → NO AUTOMATED PROOF: eval case q01 and a manual check on the deploy.
- Eval ≥ 13/15 or failures explained and re-run → NO AUTOMATED PROOF: the committed report (H, manual).
- Console workspace with $5 limit and Render key (D-037) → manual, user.

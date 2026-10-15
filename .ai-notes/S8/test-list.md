# S8 test list

## Already covered by earlier slices (no new test)
[x] I  me returns askEnabled: false without an API key  (05 §5.2 I row 9; S2)

## Cycle A: structured query and tool schema  (packages/shared/src/schemas/ask.test.ts, apps/api/src/modules/ask/tool-schema.test.ts)
[x] U  the structured-query zod schema and the generated tool JSON Schema accept and reject the same fixtures  (05 §5.8 U row 1)
[x] U  the tool schema has no optional or union parameters  (05 §5.8 U row 3)
[x] U  enum values are matched case-insensitively and normalised ("software engineer", "l3")  (05 §5.8 U row 2)

## Cycle B: semantic rule and engine gender gap  (apps/api/src/modules/ask/interpret.test.ts, apps/api/src/domain/pay-query.test.ts)
[x] U  genderGap with a gender filter or groupBy gender becomes cannot_answer with reason unsupported  (05 §5.8 U row 4)
[x] U  genderGap per group is the mean gap with the 5-and-5 minimum, local when single-currency, else USD  (04 §6 step 3; no 05 row)

## Cycle C: answer templates  (apps/api/src/modules/ask/answer.test.ts)
[x] U  answer templates: one case per row of 04 §7.6 (it.each: ungrouped money, mixed currencies, grouped, empty, suppressed, gap like-for-like, unadjusted gap, negative gap, gap rounding to zero, outside band, headcount)  (05 §5.8 U row 5)
[x] U  each cannot-answer reason maps to its message  (05 §5.8 U row 6)

## Cycle D: Anthropic interpreter  (apps/api/src/modules/ask/anthropic-interpreter.test.ts)
[x] U  sends the model, max_tokens 512, both tools as strict, tool_choice any and only the question (stub SDK client)  (05 §5.8 U row 7)
[x] U  maps a run_pay_query call to a query, and a refusal stop reason, a max_tokens stop reason or no tool call to an error  (05 §5.8 U row 8)

## Cycle E: ask endpoint  (apps/api/src/modules/ask/routes.test.ts)
[x] I  without an API key, POST /api/ask returns 503 ASK_UNAVAILABLE and writes no log row  (05 §5.8 I row 1)
[x] I  an answerable question returns the answer, the interpreted query and the interpretation list, and logs answered with the query JSON  (05 §5.8 I row 2)
[x] I  an unanswerable question returns kind cannot_answer with the template message, logged as cannot_answer  (05 §5.8 I row 3)
[x] I  an interpreter error returns 503 ASK_UPSTREAM_FAILED and logs error  (05 §5.8 I row 7)
[x] I  a 501-character question returns 400  (05 §5.8 I row 9)
    plus: 'POST /api/ask' row with 'ask.use' in access-matrix.test.ts (D-054)

## Cycle F: caps and Finance  (routes.test.ts)
[x] I  the 31st question of a user's day returns 429 with Retry-After to UTC midnight and logs rate_limited  (05 §5.8 I row 4)
[x] I  rate_limited rows don't count toward the cap  (05 §5.8 I row 5)
[x] I  the global cap of 300 returns 429 with the demo-wide message  (05 §5.8 I row 6)
[x] I  Finance asking about a group under 5 gets the "fewer than 5" sentence and no numbers  (05 §5.8 I row 8)

## Cycle G: ask page  (apps/web/src/features/ask/AskPage.test.tsx, Shell test)
[x] C  shows the answer, the "How I read your question" list and the FX note  (05 §5.8 C row 1)
[x] C  the cannot-answer suggestion fills the question box when clicked  (05 §5.8 C row 2)
[x] C  a 429 shows the reset time; a 503 upstream failure shows "Try again"  (05 §5.8 C row 3)
[x] C  a direct visit with askEnabled false shows the not-set-up message  (05 §5.8 C row 4)
[x] C  hides "Ask about pay" in the nav when askEnabled is false  (05 §5.2 C row 6)

## Cycle H: eval runner and first report (manual, needs ANTHROPIC_API_KEY)
[x] -  npm run eval scores the 15 cases and writes docs/evals/ask-eval-YYYY-MM-DD.md  (05 §6.4; no automated test)

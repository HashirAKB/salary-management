# ADR 0009: "Ask about pay" can use Google Gemini (free tier), alongside Anthropic

- Status: Accepted (amends the provider part of ADR 0008; D-036 and D-037 amended by A-009 and A-010)
- Date: 2026-10-11

## Context

ADR 0008 chose Anthropic's Claude Haiku through `@anthropic-ai/sdk`. The project owner has no Anthropic API key, and a Claude Pro subscription does not include API access. Subscription logins and Claude Code tokens may not be used by other applications. The demo and the eval need a provider that costs nothing.

## Decision

**Providers.** `ASK_PROVIDER` is `gemini` (default) or `anthropic`. Both implement `QueryInterpreter` and follow the same rules as ADR 0008: the model sees only the question, today's date and the allowed filter values; our code writes the answer; the tool input is re-parsed with the shared zod schema.

**Gemini.**
- Called over its REST API with `fetch`; no new dependency. The key is sent in the `x-goog-api-key` header.
- `GEMINI_API_KEY` is the key. `ASK_MODEL` defaults to `gemini-flash-latest` for Gemini and `claude-haiku-5-5` for Anthropic.
- One request: `systemInstruction` (the 04 section 7.3 prompt), one user message with the question, both tools as `functionDeclarations` using `parametersJsonSchema`, `toolConfig.functionCallingConfig.mode: ANY`, `maxOutputTokens: 512`, 15-second timeout, no retries.
- `strict: true` has no Gemini equivalent. The enum-only, all-required schema is still sent, and the zod re-parse rejects anything invalid as `ASK_UPSTREAM_FAILED`. A `finishReason` other than `STOP`, a blocked prompt, an HTTP error or no function call also map to `ASK_UPSTREAM_FAILED`.
- Token counts come from `usageMetadata`.

**Key handling.** `askEnabled` and the 503 `ASK_UNAVAILABLE` check use the key of the configured provider. Without it, Ask stays off (D-004).

**Spend and limits.** The free tier has no spend, but it has low request-rate limits. The app caps (30 per user, 300 per day), `max_tokens` and the timeout are unchanged. `npm run eval` waits 7 seconds between Gemini calls. A quota error returns 503 `ASK_UPSTREAM_FAILED`. The $5 workspace limit applies only to Anthropic.

**Eval.** `npm run eval` uses the configured provider and records it in the report. The 13 of 15 bar is unchanged; a different model may need prompt changes through the eval loop (05 section 6.4).

## Alternatives considered

- **Claude Pro or Claude Code token in the API client.** Outside Anthropic's terms for subscriptions and likely to be blocked.
- **Driving the Claude Code CLI as a subprocess.** Legitimate for local use, but slow, not deployable and without a schema guarantee.
- **Groq, OpenRouter free models, a local model.** Possible behind `QueryInterpreter`; Gemini's free tier was chosen for tool-calling support and simple key setup.
- **Replacing Anthropic.** Rejected: its interpreter and tests stay valid, and a paid Anthropic key remains a configuration change.

## Consequences

- No cost for the demo, but free-tier rate limits and a possible model change by the provider. On the free tier Google may use prompts to improve its products; the data is synthetic and the model never sees salaries.
- Gemini's schema support is looser than Anthropic strict mode, so more malformed replies are possible. The zod parse is the guarantee.
- The default is the rolling alias `gemini-flash-latest`: nothing to update when Google retires a model (the pinned `gemini-2.5-flash` returned 404 on the first eval run), but results can drift when the alias moves. The eval report records the model name; set `ASK_MODEL` to pin one.
- An HTTP error from Google includes its message in the interpreter error, so failures in the eval report say why.

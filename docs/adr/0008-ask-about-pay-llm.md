# ADR 0008: "Ask about pay" with Claude Haiku, strict tool use, and layered spend caps

- Status: Accepted; the provider part is amended by [ADR 0009](0009-ask-gemini-provider.md) (settles "LLM provider, key handling and spend cap"; implements D-003, D-004, D-015)
- Date: 2026-10-09

## Context

D-003 decided the shape: the model fills a structured query through a tool call, and the insights service runs it. Open were the provider and model, how to guarantee valid output, how to keep data away from the model, how to protect the key, and how to cap cost on a public demo that reviewers will use for weeks (C-003).

## Decision

**Provider and model.** Anthropic, through the official `@anthropic-ai/sdk`. Model `claude-haiku-5-5`, the fastest current Claude model, priced at $0.10 input and $0.50 output per million tokens for short prompts. A question costs about 2,000 input tokens and 150 output tokens, so roughly $0.0003.

**Output guarantee.**
- Two tools, both with `strict: true`:
  - `run_pay_query`, whose input is the D-015 structured query;
  - `cannot_answer`, with a reason and one suggested question.
- `tool_choice: { type: "any" }` forces exactly one of them.
- Filter values are enums built from the reference data, and all fields are required (empty array means no filter). This stays inside the strict-schema limits on optional and union parameters.
- The tool input is re-parsed with the shared zod schema, with case-insensitive enum matching.

**Data boundary.**
- The model receives the question, today's date and the allowed filter values. It never sees employee rows, names or salary figures.
- The insights service runs the query as the logged-in user, with the same role and Finance minimum-group rules as the insights screens.
- Our code writes the answer sentence from a template, and the interpreted query is shown beside it.

**Interface.**
- `QueryInterpreter` has one method: `interpret(question, context) -> { kind: "query", query } | { kind: "cannot_answer", reason, suggestion }`.
- `AnthropicInterpreter` implements it. `FakeInterpreter` (a fixed question-to-query map) is used in all automated tests.

**Key handling.**
- `ANTHROPIC_API_KEY` lives only in Render's environment settings and a git-ignored local `.env`.
- Without a key, `POST /api/ask` returns 503 `ASK_UNAVAILABLE`, `/api/auth/me` reports `askEnabled: false`, and the UI hides the panel (D-004).

**Spend caps, in layers:**
1. **Provider:** the key is a workspace-scoped key in a dedicated Console workspace with a monthly spend limit of $5. Spend limits can't be set on the Default Workspace, hence the dedicated one.
2. **App:** `ask_log` records every request. A user may ask 30 questions per UTC day, and everyone together 300 per day; over the cap the API returns 429 `ASK_LIMIT_REACHED` without calling the model.
3. **Request:** `max_tokens` 512, 15-second timeout, no automatic retries, and questions over 500 characters rejected with 400.

## Alternatives considered

- **Free-form text-to-SQL.** Rejected in D-003: unsafe, bypasses permissions, hard to test.
- **Letting the model write the answer from query results.** Numbers would pass through the model and could be restated wrongly. Our template is exact and testable.
- **A larger model (Sonnet or Opus).** The task is classification into a small schema, which Haiku is built for. A larger model is a config change (`ASK_MODEL`) if the eval set shows Haiku falling short.
- **Prompting for JSON without strict mode.** Needs retries and repair on malformed output. Strict tool use constrains sampling to the schema.
- **OpenAI or other providers.** Comparable for this task. Anthropic's strict tool use maps directly onto the D-003 design, and one provider keeps the README and key setup simple.
- **In-memory rate counters.** Reset on every restart and cold start, and leave no audit trail. The `ask_log` table gives both caps and history.

## Consequences

- The worst case on a public demo is $5 a month, enforced by the provider even if the app's own caps had a bug.
- A wrong answer can only come from a wrong interpretation, which the user sees on screen. The eval set (Chat 5) measures how often that happens.
- `ask_log` stores question text, which may mention a person's name. It's subject to the same access rules as other data, and the demo reset clears it.
- The feature depends on a third-party API, but nothing else in the app does (D-004).

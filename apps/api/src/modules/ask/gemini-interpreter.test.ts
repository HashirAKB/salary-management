import type { AskReference } from '@acme/shared';
import { describe, expect, it, vi } from 'vitest';
import { GeminiInterpreter } from './gemini-interpreter.ts';
import { buildToolSchemas } from './tool-schema.ts';

const reference: AskReference = {
  countries: [
    { code: 'IN', name: 'India' },
    { code: 'US', name: 'United States' },
  ],
  departments: [{ id: 1, name: 'Engineering' }],
  jobTitles: [{ id: 10, name: 'Software Engineer' }],
  levels: [
    { code: 'L1', name: 'Associate' },
    { code: 'L3', name: 'Senior' },
  ],
  genders: [
    { code: 'female', name: 'Female' },
    { code: 'male', name: 'Male' },
  ],
};

const noFilters = { countries: [], departments: [], jobTitles: [], levels: [], genders: [] };
const context = { today: '2026-10-11' };

function reply(overrides: Record<string, unknown> = {}) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              functionCall: {
                name: 'run_pay_query',
                args: {
                  metric: 'Median',
                  groupBy: 'none',
                  filters: { ...noFilters, levels: ['l3'] },
                },
              },
            },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30 },
    ...overrides,
  };
}

function setup(body: unknown, { ok = true, status = 200 } = {}) {
  const fetchFn = vi.fn(async () => ({ ok, status, json: async () => body }));
  const interpreter = new GeminiInterpreter(fetchFn, {
    apiKey: 'g-key',
    model: 'gemini-test',
    reference,
  });
  return { fetchFn, interpreter };
}

describe('GeminiInterpreter request (ADR 0009)', () => {
  it('sends the model, 512 tokens, both tools, a forced tool call and only the question', async () => {
    const { fetchFn, interpreter } = setup(reply());
    await interpreter.interpret('What is the median salary?', context);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'g-key' });
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    const tools = buildToolSchemas(reference);
    expect(body.tools).toEqual([
      {
        functionDeclarations: [tools.runPayQuery, tools.cannotAnswer].map((t) => ({
          name: t.name,
          description: t.description,
          parametersJsonSchema: t.input_schema,
        })),
      },
    ]);
    expect(body.toolConfig).toEqual({ functionCallingConfig: { mode: 'ANY' } });
    expect(body.generationConfig).toMatchObject({ maxOutputTokens: 512 });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'What is the median salary?' }] },
    ]);
    const system = (body.systemInstruction as { parts: { text: string }[] }).parts[0]!.text;
    expect(system).toContain("Today's date is 2026-10-11.");
    expect(system).not.toContain('{{today}}');
  });
});

describe('GeminiInterpreter response mapping (ADR 0009)', () => {
  it('maps a run_pay_query call to a normalised query with token counts', async () => {
    const { interpreter } = setup(reply());
    await expect(interpreter.interpret('q', context)).resolves.toEqual({
      kind: 'query',
      query: { metric: 'median', groupBy: 'none', filters: { ...noFilters, levels: ['L3'] } },
      inputTokens: 120,
      outputTokens: 30,
    });
  });

  it('maps a cannot_answer call to a cannot_answer result', async () => {
    const { interpreter } = setup(
      reply({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'cannot_answer',
                    args: { reason: 'trend', suggestion: 'What is the median salary?' },
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    await expect(interpreter.interpret('q', context)).resolves.toMatchObject({
      kind: 'cannot_answer',
      reason: 'trend',
      suggestion: 'What is the median salary?',
    });
  });

  it.each([
    ['a safety finish reason', { candidates: [{ finishReason: 'SAFETY' }] }],
    [
      'a MAX_TOKENS finish reason',
      { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'cut' }] } }] },
    ],
    ['a blocked prompt', { candidates: undefined, promptFeedback: { blockReason: 'SAFETY' } }],
    [
      'no function call',
      { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Sure!' }] } }] },
    ],
    [
      'arguments that fail the schema',
      {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'run_pay_query',
                    args: { metric: 'mode', groupBy: 'none', filters: noFilters },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  ])('rejects %s', async (_label, overrides) => {
    const { interpreter } = setup(reply(overrides));
    await expect(interpreter.interpret('q', context)).rejects.toThrow();
  });

  it('rejects an HTTP error response and a failed request', async () => {
    const { interpreter } = setup({ error: { message: 'quota' } }, { ok: false, status: 429 });
    await expect(interpreter.interpret('q', context)).rejects.toThrow();

    const failing = new GeminiInterpreter(
      async () => {
        throw new Error('timeout');
      },
      { apiKey: 'k', model: 'm', reference },
    );
    await expect(failing.interpret('q', context)).rejects.toThrow();
  });
});

import type { AskReference } from '@acme/shared';
import { describe, expect, it, vi } from 'vitest';
import { AnthropicInterpreter } from './anthropic-interpreter.ts';
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
    stop_reason: 'tool_use',
    usage: { input_tokens: 120, output_tokens: 30 },
    content: [
      {
        type: 'tool_use',
        id: 't1',
        name: 'run_pay_query',
        input: { metric: 'Median', groupBy: 'none', filters: { ...noFilters, levels: ['l3'] } },
      },
    ],
    ...overrides,
  };
}

function setup(response: unknown) {
  const create = vi.fn(async () => response);
  const interpreter = new AnthropicInterpreter(
    { messages: { create } },
    { model: 'claude-test-model', reference },
  );
  return { create, interpreter };
}

describe('AnthropicInterpreter request (04 section 7.1)', () => {
  it('sends the model, 512 tokens, both strict tools, tool_choice any and only the question', async () => {
    const { create, interpreter } = setup(reply());
    await interpreter.interpret('What is the median salary?', context);

    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    const tools = buildToolSchemas(reference);
    expect(body.model).toBe('claude-test-model');
    expect(body.max_tokens).toBe(512);
    expect(body.tools).toEqual([tools.runPayQuery, tools.cannotAnswer]);
    expect((body.tools as { strict: boolean }[]).every((t) => t.strict)).toBe(true);
    expect(body.tool_choice).toEqual({ type: 'any' });
    expect(body.messages).toEqual([{ role: 'user', content: 'What is the median salary?' }]);
    expect(body.system).toContain("Today's date is 2026-10-11.");
    expect(body.system).not.toContain('{{today}}');
    expect(options).toMatchObject({ timeout: 15_000 });
  });
});

describe('AnthropicInterpreter response mapping (04 section 7.4)', () => {
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
        content: [
          {
            type: 'tool_use',
            id: 't2',
            name: 'cannot_answer',
            input: { reason: 'trend', suggestion: 'What is the median salary?' },
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
    ['a refusal stop reason', { stop_reason: 'refusal' }],
    ['a max_tokens stop reason', { stop_reason: 'max_tokens' }],
    ['no tool call', { content: [{ type: 'text', text: 'Sure!' }] }],
    [
      'a tool input that fails the schema',
      {
        content: [
          {
            type: 'tool_use',
            id: 't3',
            name: 'run_pay_query',
            input: { metric: 'mode', groupBy: 'none', filters: noFilters },
          },
        ],
      },
    ],
  ])('rejects %s', async (_label, overrides) => {
    const { interpreter } = setup(reply(overrides));
    await expect(interpreter.interpret('q', context)).rejects.toThrow();
  });

  it('rejects when the SDK call fails', async () => {
    const interpreter = new AnthropicInterpreter(
      {
        messages: {
          create: async () => {
            throw new Error('timeout');
          },
        },
      },
      { model: 'm', reference },
    );
    await expect(interpreter.interpret('q', context)).rejects.toThrow();
  });
});

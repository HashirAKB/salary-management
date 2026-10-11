import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeInterpreter, questionOf } from '../../../test/ask.ts';
import { anEmployee, loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testConfig, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';
import { askLog, type Role } from '../../db/schema.ts';
import type { QueryInterpreter } from './interpreter.ts';

describe('POST /api/ask (K1)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(
    options: {
      role?: Role;
      key?: string;
      interpreter?: QueryInterpreter;
      seed?: (db: Db) => Promise<void>;
    } = {},
  ) {
    const db = await testDb();
    await options.seed?.(db);
    const { cookie } = await loggedInAs(db, options.role ?? 'hr_admin');
    app = testApp({
      db,
      config: { ...testConfig, anthropicApiKey: 'key' in options ? options.key : 'test-key' },
      interpreter: options.interpreter ?? fakeInterpreter(),
    });
    const ask = (question: string) =>
      app!.inject({ method: 'POST', url: '/api/ask', headers: { cookie }, payload: { question } });
    return { db, ask };
  }

  // Three active women, Software Engineer, L3, India, at the band mid (the builder's default).
  const threeIndians = async (db: Db) => {
    for (let i = 0; i < 3; i++) await anEmployee().insert(db);
  };

  it('without an API key returns 503 ASK_UNAVAILABLE and writes no log row', async () => {
    const { db, ask } = await setup({ key: undefined });

    const response = await ask(questionOf('q01'));

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: 'ASK_UNAVAILABLE',
      detail: "Ask about pay isn't set up on this server.",
    });
    expect(await db.select().from(askLog)).toEqual([]);
  });

  it('returns the answer, the interpreted query and the interpretation list, and logs answered', async () => {
    const { db, ask } = await setup({ seed: threeIndians });

    const response = await ask(questionOf('q01'));

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      kind: 'answer',
      question: questionOf('q01'),
      interpretedQuery: {
        metric: 'median',
        groupBy: 'none',
        filters: { countries: ['IN'], jobTitles: ['Software Engineer'], levels: ['L3'] },
      },
      interpretation: [
        { label: 'Metric', value: 'Median salary' },
        { label: 'Grouped by', value: 'Nothing' },
        { label: 'Country', value: 'India' },
        { label: 'Job title', value: 'Software Engineer' },
        { label: 'Level', value: 'L3 Senior' },
      ],
      usage: { usedToday: 1, dailyLimit: 30 },
    });
    expect(body.answer).toMatch(
      /^Median salary for Software Engineer, L3 Senior, India: INR [\d,]+ \(USD [\d,]+\), based on 3 active employees\.$/,
    );
    expect(body.result.groupBy).toBe('none');
    expect(body.result.rows).toHaveLength(1);
    expect(body.result.rows[0]).toMatchObject({
      key: 'all',
      label: 'All matching employees',
      headcount: 3,
      suppressed: false,
      value: { type: 'money', usd: { currency: 'USD' }, local: { currency: 'INR' } },
    });
    expect(typeof body.fxAsOf).toBe('string');

    const [row] = await db.select().from(askLog);
    expect(row).toMatchObject({
      question: questionOf('q01'),
      outcome: 'answered',
      inputTokens: 100,
      outputTokens: 20,
    });
    expect(JSON.parse(row!.interpretedQuery!)).toEqual(body.interpretedQuery);
  });

  it('returns kind cannot_answer with the template message, logged as cannot_answer', async () => {
    const { db, ask } = await setup();

    const response = await ask(questionOf('q11'));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      kind: 'cannot_answer',
      question: questionOf('q11'),
      reason: 'edit',
      message: "Ask about pay can't change data. Use the employee pages to make changes.",
      suggestion: 'What is the median salary in India?',
      examples: [
        'How does total payroll split by country?',
        'How many people are paid outside their band in the US?',
        'What is the gender pay gap for Account Executives by level?',
      ],
      usage: { usedToday: 1, dailyLimit: 30 },
    });
    const [row] = await db.select().from(askLog);
    expect(row).toMatchObject({ outcome: 'cannot_answer', interpretedQuery: null });
  });

  it('an interpreter error returns 503 ASK_UPSTREAM_FAILED and logs error', async () => {
    const { db, ask } = await setup({ interpreter: fakeInterpreter([], { throws: true }) });

    const response = await ask(questionOf('q01'));

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: 'ASK_UPSTREAM_FAILED',
      detail: "Couldn't read that question right now. Try again, or rephrase it.",
    });
    const [row] = await db.select().from(askLog);
    expect(row).toMatchObject({ outcome: 'error', interpretedQuery: null });
  });

  it('a 501-character question returns 400', async () => {
    const { db, ask } = await setup();

    const response = await ask('a'.repeat(501));

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await db.select().from(askLog)).toEqual([]);
  });
});

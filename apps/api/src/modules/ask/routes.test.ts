import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeInterpreter, questionOf } from '../../../test/ask.ts';
import { aUser, anEmployee, loggedInAs } from '../../../test/builders/index.ts';
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

  it('with the gemini provider and only an Anthropic key returns 503 ASK_UNAVAILABLE', async () => {
    const db = await testDb();
    const { cookie } = await loggedInAs(db, 'hr_admin');
    app = testApp({
      db,
      config: {
        ...testConfig,
        askProvider: 'gemini',
        geminiApiKey: undefined,
        anthropicApiKey: 'a-key',
      },
      interpreter: fakeInterpreter(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ask',
      headers: { cookie },
      payload: { question: questionOf('q01') },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'ASK_UNAVAILABLE' });
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

  // Rows for the cap tests, written straight to the log (05 section 4.2).
  const logRows = (
    db: Db,
    userId: number,
    count: number,
    outcome: 'answered' | 'rate_limited',
    askedAt = '2026-10-09T01:00:00.000Z',
  ) =>
    db
      .insert(askLog)
      .values(Array.from({ length: count }, () => ({ userId, askedAt, question: 'q', outcome })));

  describe('daily caps (D-037)', () => {
    it("the 31st question of a user's day returns 429 with Retry-After to UTC midnight and logs rate_limited", async () => {
      const { db, ask } = await setup();
      const [user] = await db.all<{ id: number }>('SELECT id FROM users');
      await logRows(db, user!.id, 30, 'answered');

      const response = await ask(questionOf('q01'));

      expect(response.statusCode).toBe(429);
      expect(response.json()).toMatchObject({
        code: 'ASK_LIMIT_REACHED',
        detail: "You've used your 30 questions for today.",
      });
      // The test clock reads 09:00 UTC, so midnight is 15 hours away.
      expect(response.headers['retry-after']).toBe(String(15 * 60 * 60));
      const limited = (await db.select().from(askLog)).filter((r) => r.outcome === 'rate_limited');
      expect(limited).toHaveLength(1);
      expect(limited[0]).toMatchObject({ question: questionOf('q01'), interpretedQuery: null });
    });

    it("rate_limited rows and yesterday's rows don't count toward the cap", async () => {
      const { db, ask } = await setup();
      const [user] = await db.all<{ id: number }>('SELECT id FROM users');
      await logRows(db, user!.id, 29, 'answered');
      await logRows(db, user!.id, 3, 'rate_limited');
      await logRows(db, user!.id, 10, 'answered', '2026-10-08T23:59:59.000Z');

      const thirtieth = await ask(questionOf('q01'));
      const thirtyFirst = await ask(questionOf('q01'));

      expect(thirtieth.statusCode).toBe(200);
      expect(thirtieth.json()).toMatchObject({ usage: { usedToday: 30, dailyLimit: 30 } });
      expect(thirtyFirst.statusCode).toBe(429);
    });

    it('the global cap of 300 returns 429 with the demo-wide message', async () => {
      const { db, ask } = await setup();
      const other = await aUser('hr_viewer').insert(db);
      await logRows(db, other.id, 300, 'answered');

      const response = await ask(questionOf('q01'));

      expect(response.statusCode).toBe(429);
      expect(response.json()).toMatchObject({
        code: 'ASK_LIMIT_REACHED',
        detail: "The demo has reached today's question limit.",
      });
      expect(response.headers['retry-after']).toBe(String(15 * 60 * 60));
    });
  });

  it('Finance asking about a group under 5 gets the "fewer than 5" sentence and no numbers', async () => {
    const { ask } = await setup({ role: 'finance', seed: threeIndians });

    const response = await ask(questionOf('q01'));

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.answer).toBe(
      'Some figures are hidden to protect groups of fewer than 5 employees.',
    );
    expect(body.result.rows).toEqual([
      {
        key: 'all',
        label: 'All matching employees',
        headcount: null,
        suppressed: true,
        value: null,
      },
    ]);
  });
});

import { insightsSummaryResponseSchema } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs, merit } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';
import { fixedClock } from '../../domain/clock.ts';
import type { Role } from '../../db/schema.ts';

describe('GET /api/insights/summary (I1)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(
    seed: (db: Db) => Promise<void>,
    options: { role?: Role; today?: string } = {},
  ) {
    const db = await testDb();
    await seed(db);
    const { cookie } = await loggedInAs(db, options.role ?? 'hr_admin', {
      ...(options.today ? { createdAt: `${options.today}T08:00:00.000Z` } : {}),
    });
    app = testApp({
      db,
      ...(options.today ? { clock: fixedClock(`${options.today}T09:00:00.000Z`) } : {}),
    });
    return (query = '') =>
      app!.inject({ method: 'GET', url: `/api/insights/summary${query}`, headers: { cookie } });
  }

  // Software Engineer, L3 everywhere. Band limits (minor units): Germany 7_600_000 to
  // 11_400_000 EUR, India 164_000_000 to 246_000_000 INR, United States 11_800_000 to
  // 17_600_000 USD. Rates: EUR 1.16, INR 0.0115, USD 1. "Today" is 2026-10-09, so salaries
  // unchanged since before 2024-10-09 are stale; the hire date is 2022-01-10.
  //
  // Germany, 5 people (EUR): 3 x 9_500_000 inside and changed in 2025; 7_000_000 below;
  //   12_000_000 above; the last two never changed. Local 47_500_000; USD 55_100_000.
  // India, 3 people (INR): 2 x 205_000_000 inside, 100_000_000 below, none changed.
  //   Local 510_000_000; USD 4_715_000 + 1_150_000 = 5_865_000.
  // United States, 5 people (USD): 14_700_000 inside x 4, one changed on 2024-10-09 (not
  //   stale), one on 2024-10-08 (stale), two in 2025; 20_000_000 above, changed in 2025.
  //   Total 78_800_000.
  // One terminated US employee on 99_999_999 is left out everywhere.
  async function fixture(db: Db) {
    const german = () => anEmployee().inCountry('DE').withSalary(9_500_000);
    for (let i = 0; i < 3; i++)
      await german()
        .withHistory([merit('2025-03-01', 0)])
        .insert(db);
    await anEmployee().inCountry('DE').withSalary(7_000_000).insert(db);
    await anEmployee().inCountry('DE').withSalary(12_000_000).insert(db);
    for (let i = 0; i < 2; i++)
      await anEmployee().inCountry('IN').withSalary(205_000_000).insert(db);
    await anEmployee().inCountry('IN').withSalary(100_000_000).insert(db);
    const american = () => anEmployee().inCountry('US').withSalary(14_700_000);
    await american()
      .withHistory([merit('2024-10-09', 0)])
      .insert(db);
    await american()
      .withHistory([merit('2024-10-08', 0)])
      .insert(db);
    for (let i = 0; i < 2; i++)
      await american()
        .withHistory([merit('2025-03-01', 0)])
        .insert(db);
    await anEmployee()
      .inCountry('US')
      .withSalary(20_000_000)
      .withHistory([merit('2025-03-01', 0)])
      .insert(db);
    await anEmployee().inCountry('US').withSalary(99_999_999).terminatedOn('2025-06-30').insert(db);
  }

  it('matches the hand-computed fixture', async () => {
    const get = await setup(fixture);

    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(insightsSummaryResponseSchema.parse(response.json())).toEqual({
      fxAsOf: '2026-09-30',
      headcount: 13,
      payrollUsd: { amountMinor: 139_765_000, currency: 'USD' },
      byCountry: [
        {
          country: { code: 'DE', name: 'Germany' },
          headcount: 5,
          suppressed: false,
          payrollLocal: { amountMinor: 47_500_000, currency: 'EUR' },
          payrollUsd: { amountMinor: 55_100_000, currency: 'USD' },
        },
        {
          country: { code: 'IN', name: 'India' },
          headcount: 3,
          suppressed: false,
          payrollLocal: { amountMinor: 510_000_000, currency: 'INR' },
          payrollUsd: { amountMinor: 5_865_000, currency: 'USD' },
        },
        {
          country: { code: 'US', name: 'United States' },
          headcount: 5,
          suppressed: false,
          payrollLocal: { amountMinor: 78_800_000, currency: 'USD' },
          payrollUsd: { amountMinor: 78_800_000, currency: 'USD' },
        },
      ],
      outsideBand: { below: 2, above: 2, total: 4 },
      staleSalaries: { since: '2024-10-09', count: 6 },
    });
  });

  it('leaves terminated employees out of every figure', async () => {
    const get = await setup(async (db) => {
      await anEmployee().inCountry('US').withSalary(10_000_000).insert(db);
      await anEmployee()
        .inCountry('US')
        .withSalary(99_999_999)
        .terminatedOn('2025-06-30')
        .insert(db);
    });

    const body = insightsSummaryResponseSchema.parse((await get()).json());

    expect(body.headcount).toBe(1);
    expect(body.payrollUsd.amountMinor).toBe(10_000_000);
    expect(body.byCountry).toHaveLength(1);
    expect(body.outsideBand.total).toBe(1);
    expect(body.staleSalaries.count).toBe(1);
  });

  it.each([
    ['2026-10-09', '2024-10-09'],
    ['2027-03-15', '2025-03-15'],
  ])('staleSalaries.since on %s is %s, two years earlier', async (today, since) => {
    const get = await setup(async () => {}, { today });

    const body = insightsSummaryResponseSchema.parse((await get()).json());

    expect(body.staleSalaries.since).toBe(since);
  });

  it('shows Finance a 3-person country as suppressed and HR Admin its numbers', async () => {
    const finance = insightsSummaryResponseSchema.parse(
      (await (await setup(fixture, { role: 'finance' }))()).json(),
    );
    await app?.close();
    const hr = insightsSummaryResponseSchema.parse(
      (await (await setup(fixture, { role: 'hr_admin' }))()).json(),
    );

    expect(finance.byCountry.find((c) => c.country.code === 'IN')).toEqual({
      country: { code: 'IN', name: 'India' },
      headcount: null,
      suppressed: true,
      payrollLocal: null,
      payrollUsd: null,
    });
    // With only India hidden, Finance could subtract the others from the total (D-071), so
    // the smallest visible country, Germany (tied with the United States on 5, by code), goes too.
    expect(finance.byCountry.find((c) => c.country.code === 'DE')).toMatchObject({
      headcount: null,
      suppressed: true,
      payrollLocal: null,
      payrollUsd: null,
    });
    expect(finance.byCountry.find((c) => c.country.code === 'US')?.suppressed).toBe(false);
    expect(finance.headcount).toBe(13);
    expect(hr.byCountry.find((c) => c.country.code === 'IN')).toMatchObject({
      headcount: 3,
      suppressed: false,
      payrollUsd: { amountMinor: 5_865_000, currency: 'USD' },
    });
  });

  it('rejects an unknown query parameter', async () => {
    const get = await setup(async () => {});

    expect((await get('?country=US')).statusCode).toBe(400);
  });
});

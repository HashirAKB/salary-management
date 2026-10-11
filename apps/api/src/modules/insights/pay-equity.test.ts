import { payEquityResponseSchema } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';
import type { Role } from '../../db/schema.ts';

describe('GET /api/insights/pay-equity (I3)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(seed: (db: Db) => Promise<void>, role: Role = 'hr_admin') {
    const db = await testDb();
    await seed(db);
    const { cookie } = await loggedInAs(db, role);
    app = testApp({ db });
    return async (query = '') => {
      const response = await app!.inject({
        method: 'GET',
        url: `/api/insights/pay-equity${query}`,
        headers: { cookie },
      });
      const body =
        response.statusCode === 200 ? payEquityResponseSchema.parse(response.json()) : undefined;
      return { response, body };
    };
  }

  // Rates: EUR 1.16, INR 0.0115, USD 1. Three cohorts, all active:
  // Germany, Software Engineer, L3 (EUR): 5 women on 9_000_000, 5 men on 10_000_000. Mean gap
  //   10.0%, flagged.
  // United States, Software Engineer, L3 (USD): 5 women on 14_000_000, 5 men on 14_200_000.
  //   Gap 1.4%, comparable, not flagged.
  // India, Data Analyst, L2 (INR): 4 women and 5 men, all on 100_000_000. Not comparable.
  // A terminated US woman on 1 is left out.
  // Org in USD: 14 women, mean 9_057_143 (126_800_000 / 14), median 10_440_000; 15 men, mean
  //   8_983_333 (134_750_000 / 15), median 11_600_000. Mean gap -0.8%, median gap 10.0%.
  async function fixture(db: Db) {
    const staff = async (
      country: string,
      gender: 'female' | 'male',
      count: number,
      salary: number,
    ) => {
      for (let i = 0; i < count; i++)
        await anEmployee().inCountry(country).withGender(gender).withSalary(salary).insert(db);
    };
    await staff('DE', 'female', 5, 9_000_000);
    await staff('DE', 'male', 5, 10_000_000);
    await staff('US', 'female', 5, 14_000_000);
    await staff('US', 'male', 5, 14_200_000);
    const analyst = async (gender: 'female' | 'male', count: number) => {
      for (let i = 0; i < count; i++)
        await anEmployee()
          .inCountry('IN')
          .withTitle(2)
          .atLevel('L2')
          .withGender(gender)
          .withSalary(100_000_000)
          .insert(db);
    };
    await analyst('female', 4);
    await analyst('male', 5);
    await anEmployee().inCountry('US').withSalary(1).terminatedOn('2025-06-30').insert(db);
  }

  const cohortKeys = (body: { cohorts: { country: { code: string }; flagged: boolean }[] }) =>
    body.cohorts.map((c) => [c.country.code, c.flagged]);

  it('returns the flagged cohort first and hides the not-comparable one', async () => {
    const get = await setup(fixture);

    const { response, body } = await get();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      fxAsOf: '2026-09-30',
      thresholdPct: 5,
      minPerGender: 5,
      org: { meanGapPct: -0.8, medianGapPct: 10, women: 14, men: 15, basis: 'usd' },
      cohortCounts: { withEmployees: 3, comparable: 2, flagged: 1 },
    });
    expect(body?.cohorts).toEqual([
      {
        country: { code: 'DE', name: 'Germany' },
        jobTitle: { id: 1, name: 'Software Engineer' },
        level: { code: 'L3', name: 'Senior' },
        comparable: true,
        women: 5,
        men: 5,
        meanWomen: { amountMinor: 9_000_000, currency: 'EUR' },
        meanMen: { amountMinor: 10_000_000, currency: 'EUR' },
        gapPct: 10,
        flagged: true,
      },
      expect.objectContaining({ country: { code: 'US', name: 'United States' }, gapPct: 1.4 }),
    ]);
  });

  it('adds the not-comparable cohort, last and without numbers, when asked', async () => {
    const get = await setup(fixture);

    const { body } = await get('?includeNotComparable=true');

    expect(cohortKeys(body!)).toEqual([
      ['DE', true],
      ['US', false],
      ['IN', false],
    ]);
    expect(body?.cohorts[2]).toEqual({
      country: { code: 'IN', name: 'India' },
      jobTitle: { id: 2, name: 'Data Analyst' },
      level: { code: 'L2', name: 'Intermediate' },
      comparable: false,
      women: null,
      men: null,
      meanWomen: null,
      meanMen: null,
      gapPct: null,
      flagged: false,
    });
  });

  it('keeps only flagged cohorts with flaggedOnly, and the counts as before', async () => {
    const get = await setup(fixture);

    const { body } = await get('?flaggedOnly=true&includeNotComparable=true');

    expect(cohortKeys(body!)).toEqual([['DE', true]]);
    expect(body?.cohortCounts).toEqual({ withEmployees: 3, comparable: 2, flagged: 1 });
  });

  it('filters cohorts and their counts by country and department, not the org figures', async () => {
    const get = await setup(fixture);

    const byCountry = (await get('?country=US')).body;
    const byDepartment = (await get('?department=2')).body;

    expect(cohortKeys(byCountry!)).toEqual([['US', false]]);
    expect(byCountry?.cohortCounts).toEqual({ withEmployees: 1, comparable: 1, flagged: 0 });
    expect(byCountry?.org).toMatchObject({ women: 14, men: 15 });
    expect(byDepartment?.cohorts).toEqual([]);
    expect(byDepartment?.cohortCounts).toEqual({ withEmployees: 0, comparable: 0, flagged: 0 });
  });

  it('gives Finance and HR the same body (D-047)', async () => {
    const hr = (await (await setup(fixture, 'hr_viewer'))('?includeNotComparable=true')).body;
    await app?.close();
    const finance = (await (await setup(fixture, 'finance'))('?includeNotComparable=true')).body;

    expect(finance).toEqual(hr);
    expect(finance?.cohorts).toHaveLength(3);
  });

  it.each(['country=ZZ', 'department=99', 'flaggedOnly=maybe', 'groupBy=country'])(
    'rejects %s with 400',
    async (query) => {
      const get = await setup(fixture);

      expect((await get(`?${query}`)).response.statusCode).toBe(400);
    },
  );
});

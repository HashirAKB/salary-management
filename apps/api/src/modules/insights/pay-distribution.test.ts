import { payDistributionResponseSchema } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';

describe('GET /api/insights/pay-distribution (I2)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(seed: (db: Db) => Promise<void>) {
    const db = await testDb();
    await seed(db);
    const { cookie } = await loggedInAs(db, 'hr_admin');
    app = testApp({ db });
    return async (query = '') => {
      const response = await app!.inject({
        method: 'GET',
        url: `/api/insights/pay-distribution${query}`,
        headers: { cookie },
      });
      const body =
        response.statusCode === 200
          ? payDistributionResponseSchema.parse(response.json())
          : undefined;
      return { response, body };
    };
  }

  // Rates: EUR 1.16, USD 1. Job titles: 1 Software Engineer and 2 Data Analyst (Engineering, 1),
  // 3 Product Manager (Product, 2).
  // Germany (EUR), Software Engineer L3: two women on 9_500_000 and a man on 10_000_000, which
  //   is 11_020_000, 11_020_000 and 11_600_000 in USD.
  // United States (USD): a Data Analyst L2 man on 8_000_000 and a Product Manager L1
  //   non-binary employee on 6_000_000.
  // A terminated US employee on 99_999_999 is left out.
  async function fixture(db: Db) {
    const german = () => anEmployee().inCountry('DE').withSalary(9_500_000);
    await german().insert(db);
    await german().insert(db);
    await anEmployee().inCountry('DE').withSalary(10_000_000).withGender('male').insert(db);
    await anEmployee()
      .inCountry('US')
      .withTitle(2)
      .atLevel('L2')
      .withGender('male')
      .withSalary(8_000_000)
      .insert(db);
    await anEmployee()
      .inCountry('US')
      .withTitle(3)
      .atLevel('L1')
      .withGender('non_binary')
      .withSalary(6_000_000)
      .insert(db);
    await anEmployee().inCountry('US').withSalary(99_999_999).terminatedOn('2025-06-30').insert(db);
  }

  it.each([
    ['none', [['all', 'All active employees', 5]]],
    [
      'country',
      [
        ['DE', 'Germany', 3],
        ['US', 'United States', 2],
      ],
    ],
    [
      'department',
      [
        ['1', 'Engineering', 4],
        ['2', 'Product', 1],
      ],
    ],
    [
      'jobTitle',
      [
        ['2', 'Data Analyst', 1],
        ['3', 'Product Manager', 1],
        ['1', 'Software Engineer', 3],
      ],
    ],
    [
      'level',
      [
        ['L1', 'L1 Associate', 1],
        ['L2', 'L2 Intermediate', 1],
        ['L3', 'L3 Senior', 3],
      ],
    ],
    [
      'gender',
      [
        ['female', 'Female', 2],
        ['male', 'Male', 2],
        ['non_binary', 'Non-binary', 1],
      ],
    ],
  ])('groups by %s in order', async (groupBy, expected) => {
    const get = await setup(fixture);

    const { response, body } = await get(`?groupBy=${groupBy}`);

    expect(response.statusCode).toBe(200);
    expect(body?.groupBy).toBe(groupBy);
    expect(body?.fxAsOf).toBe('2026-09-30');
    expect(body?.groups.map((g) => [g.key, g.label, g.headcount])).toEqual(expected);
  });

  it('groups by country when groupBy is left out', async () => {
    const get = await setup(fixture);

    expect((await get()).body?.groupBy).toBe('country');
  });

  it('gives the seven figures in USD and, for a one-currency group, in local money', async () => {
    const get = await setup(fixture);

    const { body } = await get('?groupBy=country');

    const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' });
    const eur = (amountMinor: number) => ({ amountMinor, currency: 'EUR' });
    expect(body?.groups[0]).toEqual({
      key: 'DE',
      label: 'Germany',
      headcount: 3,
      suppressed: false,
      usd: {
        min: usd(11_020_000),
        p25: usd(11_020_000),
        median: usd(11_020_000),
        p75: usd(11_310_000),
        max: usd(11_600_000),
        average: usd(11_213_333),
        total: usd(33_640_000),
      },
      local: {
        min: eur(9_500_000),
        p25: eur(9_500_000),
        median: eur(9_500_000),
        p75: eur(9_750_000),
        max: eur(10_000_000),
        average: eur(9_666_667),
        total: eur(29_000_000),
      },
    });
  });

  it('leaves local out for a group that spans currencies', async () => {
    const get = await setup(fixture);

    const { body } = await get('?groupBy=department');

    expect(body?.groups[0]?.usd).not.toBeNull();
    expect(body?.groups[0]?.local).toBeNull();
  });

  it('applies the filters and echoes them', async () => {
    const get = await setup(fixture);

    const { body } = await get('?groupBy=gender&country=DE&department=1&jobTitle=1&level=L3');

    expect(body?.filters).toEqual({
      countries: ['DE'],
      departmentIds: [1],
      jobTitleIds: [1],
      levelCodes: ['L3'],
      genders: [],
    });
    expect(body?.groups.map((g) => [g.key, g.headcount])).toEqual([
      ['female', 2],
      ['male', 1],
    ]);
  });

  it('filters by gender', async () => {
    const get = await setup(fixture);

    const { body } = await get('?groupBy=country&gender=male');

    expect(body?.filters.genders).toEqual(['male']);
    expect(body?.groups.map((g) => [g.key, g.headcount])).toEqual([
      ['DE', 1],
      ['US', 1],
    ]);
  });

  it('returns no groups when nothing matches', async () => {
    const get = await setup(fixture);

    const { response, body } = await get('?country=IN');

    expect(response.statusCode).toBe(200);
    expect(body?.groups).toEqual([]);
  });

  it.each(['groupBy=salary', 'country=ZZ', 'band=below'])('rejects %s with 400', async (query) => {
    const get = await setup(fixture);

    expect((await get(`?${query}`)).response.statusCode).toBe(400);
  });
});

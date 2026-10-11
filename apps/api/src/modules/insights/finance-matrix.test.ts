import {
  insightsSummaryResponseSchema,
  payDistributionResponseSchema,
  payEquityResponseSchema,
} from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';

// What Finance may see, reduced to one shape for every endpoint: a group either is hidden and
// carries no figure at all, or has at least 5 people behind it (D-012).
interface Group {
  hidden: boolean;
  people: number | null;
  figures: unknown[];
}

const DISTRIBUTION_GROUPS = ['none', 'country', 'department', 'jobTitle', 'level', 'gender'];

const endpoints: {
  name: string;
  url: string;
  groups: (json: unknown) => Group[];
  // D-071: one hidden group next to visible ones could be recovered by subtraction.
  checksDifferencing: boolean;
}[] = [
  {
    name: 'I1 by country',
    url: '/api/insights/summary',
    groups: (json) =>
      insightsSummaryResponseSchema.parse(json).byCountry.map((g) => ({
        hidden: g.suppressed,
        people: g.headcount,
        figures: [g.headcount, g.payrollLocal, g.payrollUsd],
      })),
    checksDifferencing: true,
  },
  ...DISTRIBUTION_GROUPS.map((groupBy) => ({
    name: `I2 by ${groupBy}`,
    url: `/api/insights/pay-distribution?groupBy=${groupBy}`,
    groups: (json: unknown) =>
      payDistributionResponseSchema.parse(json).groups.map((g) => ({
        hidden: g.suppressed,
        people: g.headcount,
        figures: [g.headcount, g.usd, g.local],
      })),
    checksDifferencing: true,
  })),
  {
    name: 'I3 cohorts',
    url: '/api/insights/pay-equity?includeNotComparable=true',
    groups: (json) =>
      payEquityResponseSchema.parse(json).cohorts.map((c) => ({
        hidden: !c.comparable,
        people: c.women === null || c.men === null ? null : Math.min(c.women, c.men),
        figures: [c.women, c.men, c.meanWomen, c.meanMen, c.gapPct],
      })),
    checksDifferencing: false,
  },
];

describe('Finance never receives a group under 5 from an insights endpoint', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // 19 active employees. Rates: EUR 1.16, INR 0.0115, USD 1.
  // Germany: 10 Software Engineers, L3, 5 women and 5 men.
  // United States: 5 Software Engineers, L2, 3 women and 2 men, and 2 Product Managers, L1,
  //   not disclosed.
  // India: 2 Data Analysts, L1, non-binary.
  async function fixture(db: Db) {
    for (let i = 0; i < 10; i++) {
      await anEmployee()
        .inCountry('DE')
        .withGender(i < 5 ? 'female' : 'male')
        .insert(db);
    }
    for (let i = 0; i < 5; i++) {
      await anEmployee()
        .inCountry('US')
        .atLevel('L2')
        .withGender(i < 3 ? 'female' : 'male')
        .insert(db);
    }
    for (let i = 0; i < 2; i++) {
      await anEmployee()
        .inCountry('US')
        .withTitle(3)
        .atLevel('L1')
        .withGender('not_disclosed')
        .insert(db);
      await anEmployee()
        .inCountry('IN')
        .withTitle(2)
        .atLevel('L1')
        .withGender('non_binary')
        .insert(db);
    }
  }

  it.each(endpoints)('$name', async ({ url, groups, checksDifferencing }) => {
    const db = await testDb();
    await fixture(db);
    const { cookie } = await loggedInAs(db, 'finance');
    app = testApp({ db });

    const response = await app.inject({ method: 'GET', url, headers: { cookie } });

    expect(response.statusCode).toBe(200);
    const shown = groups(response.json());
    expect(shown.length).toBeGreaterThan(0);
    for (const group of shown) {
      if (group.hidden) {
        expect(group.figures.every((figure) => figure === null)).toBe(true);
      } else {
        expect(group.people).toBeGreaterThanOrEqual(5);
      }
    }
    if (checksDifferencing) {
      expect(shown.filter((g) => g.hidden)).not.toHaveLength(1);
    }
  });

  it.each(DISTRIBUTION_GROUPS.slice(1))(
    'hides at least one %s group in the fixture, so the matrix is not vacuous',
    async (groupBy) => {
      const db = await testDb();
      await fixture(db);
      const { cookie } = await loggedInAs(db, 'finance');
      app = testApp({ db });

      const response = await app.inject({
        method: 'GET',
        url: `/api/insights/pay-distribution?groupBy=${groupBy}`,
        headers: { cookie },
      });

      const groups = payDistributionResponseSchema.parse(response.json()).groups;
      expect(groups.some((g) => g.suppressed)).toBe(true);
    },
  );
});

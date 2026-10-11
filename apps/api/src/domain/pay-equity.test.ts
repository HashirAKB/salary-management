import { describe, expect, it } from 'vitest';
import { payRow } from './__fixtures__/pay-rows.ts';
import { computePayEquity } from './pay-equity.ts';
import type { PayRow } from './pay-query.ts';

function team(gender: string, count: number, salaryMinor: number, rest: Partial<PayRow> = {}) {
  return Array.from({ length: count }, () => payRow({ gender, salaryMinor, ...rest }));
}

describe('computePayEquity cohorts', () => {
  it('flags a cohort at exactly 5.00% and not at 4.99% unrounded', () => {
    const exact = computePayEquity([...team('male', 5, 100_000), ...team('female', 5, 95_000)]);
    expect(exact.cohorts[0]).toMatchObject({ comparable: true, gapPct: 5, flagged: true });

    // 4.99% rounds to 5.0 for display, yet must not be flagged.
    const under = computePayEquity([...team('male', 5, 100_000), ...team('female', 5, 95_010)]);
    expect(under.cohorts[0]).toMatchObject({ comparable: true, gapPct: 5, flagged: false });
  });

  it('does not flag a gap where women are paid more', () => {
    const result = computePayEquity([...team('male', 5, 90_000), ...team('female', 5, 100_000)]);
    expect(result.cohorts[0]).toMatchObject({ gapPct: -11.1, flagged: false });
  });

  it.each([
    ['4 women', 4, 5],
    ['4 men', 5, 4],
  ])('a cohort with %s is not comparable and carries no numbers', (_name, women, men) => {
    const result = computePayEquity([
      ...team('female', women, 90_000),
      ...team('male', men, 100_000),
    ]);
    expect(result.cohorts[0]).toEqual({
      countryCode: 'US',
      jobTitleId: 1,
      levelCode: 'L2',
      currency: 'USD',
      comparable: false,
      women: null,
      men: null,
      meanWomenMinor: null,
      meanMenMinor: null,
      gapPct: null,
      flagged: false,
    });
  });

  it('counts non-binary and not-disclosed in neither mean', () => {
    const result = computePayEquity([
      ...team('male', 5, 100_000),
      ...team('female', 5, 100_000),
      ...team('non_binary', 3, 1_000_000),
      ...team('not_disclosed', 2, 1),
    ]);
    expect(result.cohorts).toHaveLength(1);
    expect(result.cohorts[0]).toMatchObject({
      women: 5,
      men: 5,
      meanWomenMinor: 100_000,
      meanMenMinor: 100_000,
      gapPct: 0,
    });
    expect(result.org).toMatchObject({ women: 5, men: 5 });
  });

  it('keeps cohorts apart by country, job title and level', () => {
    const rows = [
      ...team('male', 5, 100_000),
      ...team('female', 5, 100_000),
      ...team('male', 5, 100_000, { levelCode: 'L3' }),
      ...team('female', 5, 100_000, { levelCode: 'L3' }),
      ...team('male', 5, 100_000, { jobTitleId: 2 }),
    ];
    const result = computePayEquity(rows);
    expect(result.cohorts.map((c) => [c.jobTitleId, c.levelCode, c.comparable])).toEqual([
      [1, 'L2', true],
      [1, 'L3', true],
      [2, 'L2', false],
    ]);
  });
});

describe('computePayEquity organisation gap', () => {
  it('computes mean and median gaps from per-employee USD', () => {
    // EUR at 2.0 USD per unit: 50,000 EUR is 100,000 USD.
    const eur = { currency: 'EUR', countryCode: 'DE', usdPerUnitMicros: 2_000_000 };
    const rows = [
      ...team('male', 2, 50_000, eur), // 100,000 USD each
      ...team('male', 1, 100_000), // 100,000 USD
      ...team('female', 2, 40_000, eur), // 80,000 USD each
      ...team('female', 1, 60_000), // 60,000 USD
    ];
    // men mean 100,000, women mean (80,000 + 80,000 + 60,000) / 3 = 73,333.33
    // median women 80,000 -> gap 20.0
    const { org } = computePayEquity(rows);
    expect(org).toEqual({ meanGapPct: 26.7, medianGapPct: 20, women: 3, men: 3 });
  });

  it('has no gap when there are no women or no men', () => {
    const { org } = computePayEquity(team('male', 3, 100_000));
    expect(org).toEqual({ meanGapPct: null, medianGapPct: null, women: 0, men: 3 });
  });
});

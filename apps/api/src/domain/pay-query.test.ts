import { describe, expect, it } from 'vitest';
import { payRow } from './__fixtures__/pay-rows.ts';
import { aggregatePay } from './pay-query.ts';

describe('aggregatePay: totals and averages (D-040, 02 section 4)', () => {
  it('computes total and average from per-employee USD values, never from an aggregate', () => {
    // 100_040 minor at 0.012 USD each is 1200.48, so each employee rounds down to 1200.
    // Converting the local sum instead (200_080 -> 2400.96) would give 2401.
    const rows = [
      payRow({ currency: 'INR', salaryMinor: 100_040, usdPerUnitMicros: 12_000 }),
      payRow({ currency: 'INR', salaryMinor: 100_040, usdPerUnitMicros: 12_000 }),
    ];

    const [group] = aggregatePay(rows, ['headcount', 'total', 'average'], 'none', 1);

    expect(group?.headcount).toBe(2);
    expect(group?.usd).toEqual({ total: 2400, average: 1200 });
  });

  it('rounds the average half up to the cent', () => {
    const rows = [payRow({ salaryMinor: 1001 }), payRow({ salaryMinor: 1002 })];

    const [group] = aggregatePay(rows, ['average'], 'none', 1);

    expect(group?.usd).toEqual({ average: 1002 });
  });

  it('rounds interpolated percentiles to the cent and reports min and max', () => {
    const rows = [1, 2, 3, 4].map((n) => payRow({ salaryMinor: n * 100 + 1 }));

    const [group] = aggregatePay(rows, ['min', 'p25', 'median', 'p75', 'max'], 'none', 1);

    // 101, 201, 301, 401: p25 = 176.0, median = 251.0, p75 = 326.0
    expect(group?.usd).toEqual({ min: 101, p25: 176, median: 251, p75: 326, max: 401 });
  });
});

describe('aggregatePay: local figures', () => {
  it('reports local figures when the group has one currency', () => {
    const rows = [
      payRow({ currency: 'INR', salaryMinor: 500_000, usdPerUnitMicros: 12_000 }),
      payRow({ currency: 'INR', salaryMinor: 700_000, usdPerUnitMicros: 12_000 }),
    ];

    const [group] = aggregatePay(rows, ['total', 'average', 'median'], 'none', 1);

    expect(group?.local).toEqual({ total: 1_200_000, average: 600_000, median: 600_000 });
  });

  it('omits local figures when the group mixes currencies, keeping USD', () => {
    const rows = [
      payRow({ currency: 'USD', salaryMinor: 100_000 }),
      payRow({ currency: 'INR', salaryMinor: 1_000_000, usdPerUnitMicros: 12_000 }),
    ];

    const [group] = aggregatePay(rows, ['total'], 'none', 1);

    expect(group?.local).toBeNull();
    expect(group?.usd).toEqual({ total: 100_000 + 12_000 });
  });
});

describe('aggregatePay: outside band', () => {
  it('splits below and above, and counts the band limits as inside', () => {
    // band is 800_000 to 1_200_000 in the default row
    const rows = [
      payRow({ salaryMinor: 799_999 }),
      payRow({ salaryMinor: 800_000 }),
      payRow({ salaryMinor: 1_000_000 }),
      payRow({ salaryMinor: 1_200_000 }),
      payRow({ salaryMinor: 1_200_001 }),
      payRow({ salaryMinor: 1_500_000 }),
    ];

    const [group] = aggregatePay(rows, ['outsideBandCount'], 'none', 1);

    expect(group?.outsideBand).toEqual({ below: 1, above: 2, total: 3 });
  });
});

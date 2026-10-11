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

describe('aggregatePay: minimum group size (D-012, D-040)', () => {
  const rows = [
    ...Array.from({ length: 6 }, () => payRow({ countryCode: 'US' })),
    ...Array.from({ length: 5 }, () => payRow({ countryCode: 'DE', currency: 'EUR' })),
    ...Array.from({ length: 3 }, () => payRow({ countryCode: 'IN', currency: 'INR' })),
  ];
  const metrics = ['headcount', 'total', 'outsideBandCount'] as const;

  it('suppresses a group under the minimum with no values', () => {
    const groups = aggregatePay(rows, metrics, 'country', 5);

    expect(groups.find((g) => g.key === 'IN')).toEqual({
      key: 'IN',
      label: 'IN',
      suppressed: true,
      headcount: null,
      usd: null,
      local: null,
      outsideBand: null,
    });
    expect(groups.find((g) => g.key === 'US')).toMatchObject({ suppressed: false, headcount: 6 });
  });

  it('keeps a group at exactly the minimum', () => {
    const groups = aggregatePay(rows.slice(0, 5), metrics, 'country', 5);

    expect(groups[0]?.suppressed).toBe(false);
  });

  it('suppresses the ungrouped all group when a filter leaves fewer than the minimum', () => {
    const groups = aggregatePay(rows.slice(0, 3), metrics, 'none', 5);

    expect(groups).toEqual([
      {
        key: 'all',
        label: 'All active employees',
        suppressed: true,
        headcount: null,
        usd: null,
        local: null,
        outsideBand: null,
      },
    ]);
  });

  it('suppresses nothing at the HR minimum of 1', () => {
    const groups = aggregatePay([payRow()], metrics, 'country', 1);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ suppressed: false, headcount: 1 });
  });
});

describe('aggregatePay: complementary suppression (D-071)', () => {
  const metrics = ['headcount', 'total'] as const;
  const team = (countryCode: string, count: number) =>
    Array.from({ length: count }, () => payRow({ countryCode }));

  it('also hides the smallest visible group when exactly one group is suppressed', () => {
    const groups = aggregatePay(
      [...team('US', 7), ...team('GB', 6), ...team('DE', 5), ...team('IN', 3)],
      metrics,
      'country',
      5,
    );

    expect(groups.map((g) => [g.key, g.suppressed])).toEqual([
      ['DE', true],
      ['GB', false],
      ['IN', true],
      ['US', false],
    ]);
    expect(groups.find((g) => g.key === 'DE')).toMatchObject({
      headcount: null,
      usd: null,
      local: null,
      outsideBand: null,
    });
  });

  it('breaks a tie for smallest by key', () => {
    const groups = aggregatePay(
      [...team('US', 5), ...team('DE', 5), ...team('IN', 3)],
      metrics,
      'country',
      5,
    );

    expect(groups.filter((g) => !g.suppressed).map((g) => g.key)).toEqual(['US']);
  });

  it('adds nothing when two groups are already suppressed', () => {
    const groups = aggregatePay(
      [...team('US', 6), ...team('GB', 2), ...team('IN', 3)],
      metrics,
      'country',
      5,
    );

    expect(groups.filter((g) => g.suppressed).map((g) => g.key)).toEqual(['GB', 'IN']);
  });

  it('adds nothing when the only group is the suppressed one', () => {
    const groups = aggregatePay(team('IN', 3), metrics, 'country', 5);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.suppressed).toBe(true);
  });

  it('adds nothing at the HR minimum of 1', () => {
    const groups = aggregatePay([...team('US', 6), ...team('IN', 1)], metrics, 'country', 1);

    expect(groups.every((g) => !g.suppressed)).toBe(true);
  });
});

describe('aggregatePay: grouping and order', () => {
  it('groupBy none returns one all group', () => {
    const groups = aggregatePay(
      [payRow(), payRow({ countryCode: 'IN' })],
      ['headcount'],
      'none',
      1,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'all', label: 'All active employees', headcount: 2 });
  });

  it('omits empty groups: no rows, no groups', () => {
    expect(aggregatePay([], ['headcount'], 'none', 1)).toEqual([]);
    expect(aggregatePay([], ['headcount'], 'country', 1)).toEqual([]);
  });

  it('groups by each dimension using the row value as the key', () => {
    const rows = [
      payRow({
        countryCode: 'US',
        departmentId: 7,
        jobTitleId: 3,
        levelCode: 'L4',
        gender: 'male',
      }),
    ];

    expect(aggregatePay(rows, ['headcount'], 'country', 1)[0]?.key).toBe('US');
    expect(aggregatePay(rows, ['headcount'], 'department', 1)[0]?.key).toBe('7');
    expect(aggregatePay(rows, ['headcount'], 'jobTitle', 1)[0]?.key).toBe('3');
    expect(aggregatePay(rows, ['headcount'], 'level', 1)[0]?.key).toBe('L4');
    expect(aggregatePay(rows, ['headcount'], 'gender', 1)[0]?.key).toBe('male');
  });

  it('sorts levels by rank', () => {
    const rows = ['L3', 'L1', 'L5', 'L2'].map((levelCode) => payRow({ levelCode }));

    const keys = aggregatePay(rows, ['headcount'], 'level', 1).map((g) => g.key);

    expect(keys).toEqual(['L1', 'L2', 'L3', 'L5']);
  });

  it('sorts genders in reference order', () => {
    const rows = ['not_disclosed', 'male', 'non_binary', 'female'].map((gender) =>
      payRow({ gender }),
    );

    const keys = aggregatePay(rows, ['headcount'], 'gender', 1).map((g) => g.key);

    expect(keys).toEqual(['female', 'male', 'non_binary', 'not_disclosed']);
  });

  it('sorts countries, departments and titles by name, and labels groups with it', () => {
    const rows = [
      payRow({ countryCode: 'GB' }),
      payRow({ countryCode: 'US' }),
      payRow({ countryCode: 'DE' }),
    ];
    // Name order (Alpha, Middle, Zealand) is the reverse of code order, so a sort by key fails.
    const labels = { GB: 'Zealand', US: 'Alpha', DE: 'Middle' };

    const groups = aggregatePay(rows, ['headcount'], 'country', 1, labels);

    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ['US', 'Alpha'],
      ['DE', 'Middle'],
      ['GB', 'Zealand'],
    ]);
  });
});

describe('aggregatePay: gender gap (04 section 6 step 3)', () => {
  const people = (gender: string, count: number, override: Parameters<typeof payRow>[0] = {}) =>
    Array.from({ length: count }, () => payRow({ gender, ...override }));

  it('reports the mean gap with at least 5 women and 5 men', () => {
    const rows = [
      ...people('female', 5, { salaryMinor: 920_000 }),
      ...people('male', 5, { salaryMinor: 1_000_000 }),
      ...people('non_binary', 2, { salaryMinor: 5_000_000 }),
    ];

    const [group] = aggregatePay(rows, ['genderGap'], 'none', 1);

    expect(group?.gap).toEqual({ comparable: true, women: 5, men: 5, gapPct: 8 });
  });

  it('is not comparable under 5 women or under 5 men', () => {
    const rows = [...people('female', 4), ...people('male', 9)];

    const [group] = aggregatePay(rows, ['genderGap'], 'none', 1);

    expect(group?.gap).toEqual({ comparable: false, women: null, men: null, gapPct: null });
  });

  it('uses USD when the group mixes currencies', () => {
    // Women earn 10_000 USD; men earn 1_000_000 INR at 0.012, which is 12_000 USD.
    const rows = [
      ...people('female', 5, { salaryMinor: 10_000 }),
      ...people('male', 5, { currency: 'INR', salaryMinor: 1_000_000, usdPerUnitMicros: 12_000 }),
    ];

    const [group] = aggregatePay(rows, ['genderGap'], 'none', 1);

    expect(group?.gap?.gapPct).toBe(16.7);
  });

  it('computes a gap per group', () => {
    const rows = [
      ...people('female', 5, { countryCode: 'US', salaryMinor: 900_000 }),
      ...people('male', 5, { countryCode: 'US', salaryMinor: 1_000_000 }),
      ...people('male', 2, { countryCode: 'IN' }),
    ];

    const groups = aggregatePay(rows, ['genderGap'], 'country', 1);

    expect(groups.map((g) => [g.key, g.gap?.comparable, g.gap?.gapPct])).toEqual([
      ['IN', false, null],
      ['US', true, 10],
    ]);
  });

  it('has no gap unless genderGap is asked for', () => {
    const [group] = aggregatePay(people('female', 5), ['median'], 'none', 1);

    expect(group?.gap).toBeNull();
  });

  it('reports the currency of a single-currency group, null when mixed', () => {
    const inr = aggregatePay([payRow({ currency: 'INR' })], ['median'], 'none', 1)[0];
    const mixed = aggregatePay(
      [payRow({ currency: 'INR' }), payRow({ currency: 'USD' })],
      ['median'],
      'none',
      1,
    )[0];

    expect(inr?.currency).toBe('INR');
    expect(mixed?.currency).toBeNull();
  });
});

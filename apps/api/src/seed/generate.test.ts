import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateDataset, REF_DATE, SEED, SEED_CONFIG, type Dataset } from './generate.ts';
import { SOFTWARE_ENGINEER } from './reference.ts';

// One generation shared by every test in the file; a failure fails each test, not the file.
let cached: Dataset | undefined;
const dataset = (): Dataset => (cached ??= generateDataset(SEED_CONFIG, SEED, REF_DATE));

const active = () => dataset().employees.filter((e) => e.status === 'active');

const countBy = <T>(items: readonly T[], key: (item: T) => string) => {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
};

describe('generateDataset: allocation (02 sections 7.3 and 7.5)', () => {
  it('creates exactly 10,000 active employees with the per-country counts of 02 section 7.3', () => {
    const employees = active();
    const codes = employees.map((e) => e.employeeCode).sort();

    expect(employees).toHaveLength(10_000);
    expect(countBy(employees, (e) => e.countryCode)).toEqual({
      CA: 800,
      DE: 1200,
      GB: 1500,
      IN: 4000,
      US: 2500,
    });
    expect(codes[0]).toBe('E000001');
    expect(codes[codes.length - 1]).toBe('E010000');
    expect(new Set(codes).size).toBe(10_000);
  });

  it('allocates IN / Software Engineer / L3 as 280 people: 76 women, 195 men, 3 non-binary, 6 not disclosed', () => {
    const cohort = active().filter(
      (e) => e.countryCode === 'IN' && e.jobTitleId === SOFTWARE_ENGINEER && e.levelCode === 'L3',
    );

    expect(cohort).toHaveLength(280);
    expect(countBy(cohort, (e) => e.gender)).toEqual({
      female: 76,
      male: 195,
      non_binary: 3,
      not_disclosed: 6,
    });
  });

  it('gives every employee a band', () => {
    const { payBands, employees } = dataset();
    const bandCurrency = new Map(
      payBands.map((b) => [`${b.countryCode}/${b.jobTitleId}/${b.levelCode}`, b.currencyCode]),
    );

    for (const e of employees) {
      expect(bandCurrency.get(`${e.countryCode}/${e.jobTitleId}/${e.levelCode}`)).toBe(
        e.salaryCurrency,
      );
    }
    expect(employees.length).toBeGreaterThan(0);
  });
});

type Cohort = { key: string; women: number[]; men: number[] };

// Gender gap per 02 section 4, in local currency: (meanMale - meanFemale) / meanMale * 100.
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const gapPct = (c: Cohort) => ((mean(c.men) - mean(c.women)) / mean(c.men)) * 100;

const eligibleCohorts = (): Cohort[] => {
  const cohorts = new Map<string, Cohort>();
  for (const e of active()) {
    const key = `${e.countryCode}/${e.jobTitleId}/${e.levelCode}`;
    const cohort = cohorts.get(key) ?? { key, women: [], men: [] };
    if (e.gender === 'female') cohort.women.push(e.salaryMinor);
    if (e.gender === 'male') cohort.men.push(e.salaryMinor);
    cohorts.set(key, cohort);
  }
  return [...cohorts.values()].filter((c) => c.women.length >= 5 && c.men.length >= 5);
};

describe('generateDataset: current salary (02 section 7.6)', () => {
  it('lands the four target cohorts within 0.1 points of their gap, with the expected flags, and keeps every other eligible cohort under 2.5%', () => {
    const targets: Record<string, { gap: number; flagged: boolean }> = {
      'IN/1/L3': { gap: 8.0, flagged: true },
      'US/5/L2': { gap: 6.0, flagged: true },
      'GB/1/L4': { gap: 5.3, flagged: true },
      'DE/1/L2': { gap: 4.7, flagged: false },
    };
    const cohorts = eligibleCohorts();

    for (const [key, target] of Object.entries(targets)) {
      const cohort = cohorts.find((c) => c.key === key);
      expect(cohort, key).toBeDefined();
      const gap = gapPct(cohort!);
      expect(Math.abs(gap - target.gap), `${key} gap ${gap}`).toBeLessThanOrEqual(0.1);
      expect(gap >= 5, key).toBe(target.flagged);
    }
    for (const cohort of cohorts.filter((c) => !(c.key in targets))) {
      expect(Math.abs(gapPct(cohort)), cohort.key).toBeLessThan(2.5);
    }
  });

  it('keeps the outside-band share between 5% and 8%', () => {
    const band = new Map(
      dataset().payBands.map((b) => [`${b.countryCode}/${b.jobTitleId}/${b.levelCode}`, b]),
    );

    const outside = active().filter((e) => {
      const b = band.get(`${e.countryCode}/${e.jobTitleId}/${e.levelCode}`)!;
      return e.salaryMinor < b.minMinor || e.salaryMinor > b.maxMinor;
    });

    expect(outside.length / 10_000).toBeGreaterThanOrEqual(0.05);
    expect(outside.length / 10_000).toBeLessThanOrEqual(0.08);
  });

  it('rounds salaries to the nearest 100 major units, 1,000 for INR', () => {
    const notRounded = dataset().employees.filter(
      (e) => e.salaryMinor % ((e.salaryCurrency === 'INR' ? 1000 : 100) * 100) !== 0,
    );
    const distinctSalaries = new Set(active().map((e) => e.salaryMinor));

    expect(notRounded).toEqual([]);
    expect(distinctSalaries.size).toBeGreaterThan(1000);
  });
});

const RANK: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };

let cachedHistories: Map<number, Dataset['salaryChanges']> | undefined;
const histories = () => {
  if (!cachedHistories) {
    cachedHistories = new Map();
    for (const row of dataset().salaryChanges) {
      const rows = cachedHistories.get(row.employeeId) ?? [];
      rows.push(row);
      cachedHistories.set(row.employeeId, rows);
    }
  }
  return cachedHistories;
};

describe('generateDataset: salary history (02 section 7.7)', () => {
  it('starts each history with a hire row on the hire date, keeps dates increasing, ends no later than the reference or termination date, and ends on the current salary, title and level', () => {
    for (const e of dataset().employees) {
      const rows = histories().get(e.id) ?? [];
      const first = rows[0];
      const last = rows[rows.length - 1];

      expect(first?.reason, e.employeeCode).toBe('hire');
      expect(first?.effectiveDate, e.employeeCode).toBe(e.hireDate);
      expect(e.hireDate >= '2013-10-01', e.employeeCode).toBe(true);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.effectiveDate > rows[i - 1]!.effectiveDate, e.employeeCode).toBe(true);
      }
      expect(last!.effectiveDate <= (e.terminationDate ?? REF_DATE), e.employeeCode).toBe(true);
      expect(
        {
          amountMinor: last?.amountMinor,
          currencyCode: last?.currencyCode,
          effectiveDate: last?.effectiveDate,
          jobTitleId: last?.jobTitleId,
          levelCode: last?.levelCode,
        },
        e.employeeCode,
      ).toEqual({
        amountMinor: e.salaryMinor,
        currencyCode: e.salaryCurrency,
        effectiveDate: e.salaryEffectiveDate,
        jobTitleId: e.jobTitleId,
        levelCode: e.levelCode,
      });
    }
  });

  it('changes level only on promotion rows, one rank up', () => {
    for (const rows of histories().values()) {
      for (let i = 1; i < rows.length; i++) {
        const before = rows[i - 1]!;
        const row = rows[i]!;
        const levelChanged = row.levelCode !== before.levelCode;

        expect(levelChanged).toBe(row.reason === 'promotion');
        if (levelChanged) expect(RANK[row.levelCode]).toBe(RANK[before.levelCode]! + 1);
        expect(row.jobTitleId).toBe(before.jobTitleId);
      }
    }
  });

  it('keeps the stale share between 9% and 13%', () => {
    const stale = active().filter((e) => e.salaryEffectiveDate < '2024-09-30');

    expect(stale.length / 10_000).toBeGreaterThanOrEqual(0.09);
    expect(stale.length / 10_000).toBeLessThanOrEqual(0.13);
  });

  it('builds about 4 history rows per employee, using every change reason', () => {
    const rows = dataset().salaryChanges;

    expect(rows.length / dataset().employees.length).toBeGreaterThanOrEqual(3);
    expect(rows.length / dataset().employees.length).toBeLessThanOrEqual(5);
    expect(new Set(rows.map((r) => r.reason))).toEqual(
      new Set(['hire', 'merit', 'promotion', 'market_adjustment', 'correction']),
    );
  });
});

describe('generateDataset: terminated employees (02 section 7.8)', () => {
  const terminated = () => dataset().employees.filter((e) => e.status === 'terminated');

  it('creates exactly 250 terminated employees, spread across countries in proportion to headcount', () => {
    const byCountry = countBy(terminated(), (e) => e.countryCode);
    const headcount: Record<string, number> = { CA: 800, DE: 1200, GB: 1500, IN: 4000, US: 2500 };

    expect(terminated()).toHaveLength(250);
    for (const [country, active] of Object.entries(headcount)) {
      expect(Math.abs((byCountry[country] ?? 0) - (250 * active) / 10_000), country).toBeLessThan(
        1,
      );
    }
  });

  it('terminates between 2024-01-01 and 2026-09-15, at least 6 months after hire, with codes E010001 to E010250', () => {
    const rows = terminated();
    const codes = rows.map((e) => e.employeeCode).sort();
    const sixMonthsAfter = (date: string) => {
      const d = new Date(`${date}T00:00:00.000Z`);
      d.setUTCMonth(d.getUTCMonth() + 6);
      return d.toISOString().slice(0, 10);
    };

    for (const e of rows) {
      expect(e.terminationDate! >= '2024-01-01', e.employeeCode).toBe(true);
      expect(e.terminationDate! <= '2026-09-15', e.employeeCode).toBe(true);
      expect(sixMonthsAfter(e.hireDate) <= e.terminationDate!, e.employeeCode).toBe(true);
    }
    expect(codes).toEqual(
      Array.from({ length: 250 }, (_, i) => `E${String(10_001 + i).padStart(6, '0')}`),
    );
  });

  it('spreads termination dates over the whole window, with some in 2026', () => {
    const byYear = countBy(terminated(), (e) => e.terminationDate!.slice(0, 4));

    // 989 days: 366 in 2024, 365 in 2025 and 258 in 2026, so about 65 of 250 land in 2026.
    expect(byYear['2026'] ?? 0).toBeGreaterThanOrEqual(40);
    expect(byYear['2024'] ?? 0).toBeGreaterThanOrEqual(70);
    expect(byYear['2025'] ?? 0).toBeGreaterThanOrEqual(70);
  });
});

// Recorded with the full 02 section 7.8 termination window; CI must reproduce it (06 S1 acceptance).
const RECORDED_HASH = '042be9bb34db0a76b4ea64af495db2b297f00de79340d8232bde391ca4f2cf39';

const TABLES = [
  'fxRates',
  'countries',
  'departments',
  'jobTitles',
  'levels',
  'payBands',
  'employees',
  'salaryChanges',
] as const;

const hashRows = (d: Dataset) =>
  createHash('sha256')
    .update(JSON.stringify(TABLES.map((table) => d[table])))
    .digest('hex');

describe('generateDataset: determinism (02 section 7.2)', () => {
  it('the same seed gives a deep-equal dataset, and the hash of its ordered rows matches the recorded value', () => {
    const again = generateDataset(SEED_CONFIG, SEED, REF_DATE);

    expect(again).toEqual(dataset());
    expect(hashRows(again)).toBe(RECORDED_HASH);
  });
});

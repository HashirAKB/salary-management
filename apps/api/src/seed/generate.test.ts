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

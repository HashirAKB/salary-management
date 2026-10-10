import { describe, expect, it } from 'vitest';
import type { Gender, LevelCode } from '../db/schema.ts';
import { SEED_CONFIG, type Dataset, type EmployeeRow } from './generate.ts';
import { ACCOUNT_EXECUTIVE, generateReferenceData, SOFTWARE_ENGINEER } from './reference.ts';
import { formatSeedReport, seedReport } from './report.ts';

let nextId = 1;
const employee = (fields: {
  country: string;
  title: number;
  level: LevelCode;
  gender: Gender;
  salaryMinor: number;
  currency: string;
  effective?: string;
  terminated?: boolean;
}): EmployeeRow => {
  const id = nextId++;
  return {
    id,
    employeeCode: `E${String(id).padStart(6, '0')}`,
    firstName: 'A',
    lastName: 'B',
    nameSearch: 'a b',
    gender: fields.gender,
    countryCode: fields.country,
    jobTitleId: fields.title,
    levelCode: fields.level,
    hireDate: '2020-01-01',
    status: fields.terminated ? 'terminated' : 'active',
    terminationDate: fields.terminated ? '2025-01-01' : null,
    salaryMinor: fields.salaryMinor,
    salaryCurrency: fields.currency,
    salaryEffectiveDate: fields.effective ?? '2026-04-01',
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };
};

// IN / Software Engineer / L3: 5 women at INR 1,800,000 and 5 men at INR 2,000,000 (a 10% gap).
// US / Account Executive / L2 (band USD 65,000 to 97,000): one woman below, one man above.
const smallDataset = (): Dataset => {
  nextId = 1;
  const inSe = (gender: Gender, salaryMinor: number, effective?: string) =>
    employee({
      country: 'IN',
      title: SOFTWARE_ENGINEER,
      level: 'L3',
      gender,
      salaryMinor,
      currency: 'INR',
      effective,
    });
  return {
    ...generateReferenceData(),
    employees: [
      inSe('female', 180_000_000, '2024-01-01'),
      inSe('female', 180_000_000, '2024-01-01'),
      inSe('female', 180_000_000),
      inSe('female', 180_000_000),
      inSe('female', 180_000_000),
      inSe('male', 200_000_000, '2024-09-29'),
      inSe('male', 200_000_000, '2024-09-30'),
      inSe('male', 200_000_000),
      inSe('male', 200_000_000),
      inSe('male', 200_000_000),
      employee({
        country: 'US',
        title: ACCOUNT_EXECUTIVE,
        level: 'L2',
        gender: 'female',
        salaryMinor: 6_000_000,
        currency: 'USD',
      }),
      employee({
        country: 'US',
        title: ACCOUNT_EXECUTIVE,
        level: 'L2',
        gender: 'male',
        salaryMinor: 10_000_000,
        currency: 'USD',
      }),
      employee({
        country: 'CA',
        title: SOFTWARE_ENGINEER,
        level: 'L1',
        gender: 'male',
        salaryMinor: 1_000,
        currency: 'CAD',
        effective: '2020-01-01',
        terminated: true,
      }),
    ],
    salaryChanges: [],
  };
};

describe('seedReport (02 section 7.11)', () => {
  it('the seed report counts active, terminated, history rows, outside-band and stale employees', () => {
    const dataset = smallDataset();
    dataset.salaryChanges = new Array(17).fill(dataset.salaryChanges[0]);

    const report = seedReport(dataset, SEED_CONFIG);

    expect(report).toMatchObject({
      active: 12,
      terminated: 1,
      activeByCountry: { IN: 10, US: 2 },
      terminatedByCountry: { CA: 1 },
      historyRows: 17,
      outsideBand: { below: 1, above: 1 },
      noChangeSince20240930: 3,
    });
    expect(formatSeedReport(report)).toContain('Active employees: 12 (IN 10, US 2)');
    expect(formatSeedReport(report)).toContain('Outside band: 2 (below 1, above 1)');
  });

  it('the seed report gives cohort gaps and flags, eligible cohorts, groups under 5, and org-wide USD mean and median gaps', () => {
    const report = seedReport(smallDataset(), SEED_CONFIG);

    expect(report.targetCohorts[0]).toEqual({
      countryCode: 'IN',
      jobTitle: 'Software Engineer',
      levelCode: 'L3',
      women: 5,
      men: 5,
      gapPct: 10,
      flagged: true,
    });
    expect(report.targetCohorts[1]).toMatchObject({
      countryCode: 'US',
      gapPct: null,
      flagged: false,
    });
    expect(report.eligibleCohorts).toBe(1);
    expect(report.bandCount).toBe(250);
    expect(report.groupsUnder5).toBe(1);
    // USD per employee: men 5 x 2,300,000 and 10,000,000; women 5 x 2,070,000 and 6,000,000.
    expect(report.orgGapUsd.meanPct).toBeCloseTo((858_333.333 / 3_583_333.333) * 100, 3);
    expect(report.orgGapUsd.medianPct).toBeCloseTo(10, 6);
    expect(formatSeedReport(report)).toContain(
      'IN / Software Engineer / L3: gap 10.0% (flagged), 5 women, 5 men',
    );
  });
});

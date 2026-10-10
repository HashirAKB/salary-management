import { describe, expect, it } from 'vitest';
import { generateReferenceData } from './reference.ts';

describe('generateReferenceData', () => {
  it('generates the FX rates, 5 countries, 8 departments, 10 titles and 5 levels', () => {
    const ref = generateReferenceData();

    expect(ref.fxRates).toEqual([
      { currencyCode: 'CAD', usdPerUnitMicros: 720_000, asOfDate: '2026-09-30' },
      { currencyCode: 'EUR', usdPerUnitMicros: 1_160_000, asOfDate: '2026-09-30' },
      { currencyCode: 'GBP', usdPerUnitMicros: 1_340_000, asOfDate: '2026-09-30' },
      { currencyCode: 'INR', usdPerUnitMicros: 11_500, asOfDate: '2026-09-30' },
      { currencyCode: 'USD', usdPerUnitMicros: 1_000_000, asOfDate: '2026-09-30' },
    ]);
    expect(ref.countries).toEqual([
      { code: 'CA', name: 'Canada', currencyCode: 'CAD' },
      { code: 'DE', name: 'Germany', currencyCode: 'EUR' },
      { code: 'GB', name: 'United Kingdom', currencyCode: 'GBP' },
      { code: 'IN', name: 'India', currencyCode: 'INR' },
      { code: 'US', name: 'United States', currencyCode: 'USD' },
    ]);
    expect(ref.departments.map((d) => d.name)).toEqual([
      'Engineering',
      'Product',
      'Sales',
      'Marketing',
      'Finance',
      'People',
      'Operations',
      'Customer Support',
    ]);
    const departmentOf = (title: string) => {
      const row = ref.jobTitles.find((t) => t.name === title);
      return ref.departments.find((d) => d.id === row?.departmentId)?.name;
    };
    expect(ref.jobTitles).toHaveLength(10);
    expect(departmentOf('Software Engineer')).toBe('Engineering');
    expect(departmentOf('Data Analyst')).toBe('Engineering');
    expect(departmentOf('Product Designer')).toBe('Product');
    expect(departmentOf('Account Executive')).toBe('Sales');
    expect(departmentOf('HR Generalist')).toBe('People');
    expect(departmentOf('Support Specialist')).toBe('Customer Support');
    expect(ref.levels).toEqual([
      { code: 'L1', name: 'Associate', rank: 1 },
      { code: 'L2', name: 'Intermediate', rank: 2 },
      { code: 'L3', name: 'Senior', rank: 3 },
      { code: 'L4', name: 'Lead', rank: 4 },
      { code: 'L5', name: 'Principal', rank: 5 },
    ]);
  });

  it('generates 250 bands, one per country, title and level, each with min < mid < max', () => {
    const ref = generateReferenceData();

    const keys = new Set(
      ref.payBands.map((b) => `${b.countryCode}/${b.jobTitleId}/${b.levelCode}`),
    );
    const currencyOf = new Map(ref.countries.map((c) => [c.code, c.currencyCode]));

    expect(ref.payBands).toHaveLength(250);
    expect(keys.size).toBe(250);
    for (const band of ref.payBands) {
      expect(band.currencyCode).toBe(currencyOf.get(band.countryCode));
      expect(band.minMinor).toBeGreaterThan(0);
      expect(band.minMinor).toBeLessThan(band.midMinor);
      expect(band.midMinor).toBeLessThan(band.maxMinor);
    }
  });

  it('prices India Software Engineer L3 at INR 1,640,000 / 2,050,000 / 2,460,000', () => {
    const ref = generateReferenceData();

    const softwareEngineer = ref.jobTitles.find((t) => t.name === 'Software Engineer')?.id;

    const band = ref.payBands.find(
      (b) => b.countryCode === 'IN' && b.jobTitleId === softwareEngineer && b.levelCode === 'L3',
    );

    expect(band).toEqual({
      countryCode: 'IN',
      jobTitleId: softwareEngineer,
      levelCode: 'L3',
      currencyCode: 'INR',
      minMinor: 164_000_000,
      midMinor: 205_000_000,
      maxMinor: 246_000_000,
    });
  });
});

import type {
  countries,
  departments,
  fxRates,
  jobTitles,
  LevelCode,
  levels,
  payBands,
} from '../db/schema.ts';

export type FxRateRow = typeof fxRates.$inferInsert;
export type CountryRow = typeof countries.$inferInsert;
export type DepartmentRow = typeof departments.$inferInsert;
export type JobTitleRow = typeof jobTitles.$inferInsert & { id: number };
export type LevelRow = typeof levels.$inferInsert;
export type PayBandRow = typeof payBands.$inferInsert;

export type ReferenceData = {
  fxRates: FxRateRow[];
  countries: CountryRow[];
  departments: DepartmentRow[];
  jobTitles: JobTitleRow[];
  levels: LevelRow[];
  payBands: PayBandRow[];
};

export const FX_AS_OF = '2026-09-30';

// 02 section 4: illustrative demo rates, fixed for reproducibility.
export const FX_RATES: readonly FxRateRow[] = [
  { currencyCode: 'CAD', usdPerUnitMicros: 720_000, asOfDate: FX_AS_OF },
  { currencyCode: 'EUR', usdPerUnitMicros: 1_160_000, asOfDate: FX_AS_OF },
  { currencyCode: 'GBP', usdPerUnitMicros: 1_340_000, asOfDate: FX_AS_OF },
  { currencyCode: 'INR', usdPerUnitMicros: 11_500, asOfDate: FX_AS_OF },
  { currencyCode: 'USD', usdPerUnitMicros: 1_000_000, asOfDate: FX_AS_OF },
];

export type CountrySpec = {
  code: string;
  name: string;
  currencyCode: string;
  locale: 'en_CA' | 'de' | 'en_GB' | 'en_IN' | 'en_US';
  activeHeadcount: number;
  /** Pay level vs the US, in USD. */
  payLevel: number;
};

// 02 section 7.3, sorted by code (the generation order, 02 section 7.2).
export const COUNTRIES: readonly CountrySpec[] = [
  {
    code: 'CA',
    name: 'Canada',
    currencyCode: 'CAD',
    locale: 'en_CA',
    activeHeadcount: 800,
    payLevel: 0.78,
  },
  {
    code: 'DE',
    name: 'Germany',
    currencyCode: 'EUR',
    locale: 'de',
    activeHeadcount: 1200,
    payLevel: 0.75,
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    currencyCode: 'GBP',
    locale: 'en_GB',
    activeHeadcount: 1500,
    payLevel: 0.72,
  },
  {
    code: 'IN',
    name: 'India',
    currencyCode: 'INR',
    locale: 'en_IN',
    activeHeadcount: 4000,
    payLevel: 0.16,
  },
  {
    code: 'US',
    name: 'United States',
    currencyCode: 'USD',
    locale: 'en_US',
    activeHeadcount: 2500,
    payLevel: 1.0,
  },
];

export const DEPARTMENTS: readonly DepartmentRow[] = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Product' },
  { id: 3, name: 'Sales' },
  { id: 4, name: 'Marketing' },
  { id: 5, name: 'Finance' },
  { id: 6, name: 'People' },
  { id: 7, name: 'Operations' },
  { id: 8, name: 'Customer Support' },
];

export type JobTitleSpec = JobTitleRow & {
  /** Share of headcount. */
  share: number;
  /** L1 midpoint in the US, in USD. */
  l1MidUsd: number;
  /** Women's share before the level factor. */
  womenShare: number;
};

export const SOFTWARE_ENGINEER = 1;
export const ACCOUNT_EXECUTIVE = 5;

export const JOB_TITLES: readonly JobTitleSpec[] = [
  {
    id: SOFTWARE_ENGINEER,
    name: 'Software Engineer',
    departmentId: 1,
    share: 0.28,
    l1MidUsd: 95_000,
    womenShare: 0.28,
  },
  { id: 2, name: 'Data Analyst', departmentId: 1, share: 0.07, l1MidUsd: 75_000, womenShare: 0.28 },
  {
    id: 3,
    name: 'Product Manager',
    departmentId: 2,
    share: 0.04,
    l1MidUsd: 100_000,
    womenShare: 0.45,
  },
  {
    id: 4,
    name: 'Product Designer',
    departmentId: 2,
    share: 0.04,
    l1MidUsd: 80_000,
    womenShare: 0.45,
  },
  {
    id: ACCOUNT_EXECUTIVE,
    name: 'Account Executive',
    departmentId: 3,
    share: 0.15,
    l1MidUsd: 65_000,
    womenShare: 0.4,
  },
  {
    id: 6,
    name: 'Marketing Specialist',
    departmentId: 4,
    share: 0.07,
    l1MidUsd: 60_000,
    womenShare: 0.55,
  },
  { id: 7, name: 'Accountant', departmentId: 5, share: 0.05, l1MidUsd: 62_000, womenShare: 0.5 },
  { id: 8, name: 'HR Generalist', departmentId: 6, share: 0.04, l1MidUsd: 58_000, womenShare: 0.7 },
  {
    id: 9,
    name: 'Operations Analyst',
    departmentId: 7,
    share: 0.1,
    l1MidUsd: 52_000,
    womenShare: 0.4,
  },
  {
    id: 10,
    name: 'Support Specialist',
    departmentId: 8,
    share: 0.16,
    l1MidUsd: 45_000,
    womenShare: 0.55,
  },
];

export type LevelSpec = LevelRow & {
  code: LevelCode;
  share: number;
  midMultiplier: number;
  womenFactor: number;
};

export const LEVELS: readonly LevelSpec[] = [
  { code: 'L1', name: 'Associate', rank: 1, share: 0.25, midMultiplier: 1.0, womenFactor: 1.15 },
  { code: 'L2', name: 'Intermediate', rank: 2, share: 0.3, midMultiplier: 1.25, womenFactor: 1.05 },
  { code: 'L3', name: 'Senior', rank: 3, share: 0.25, midMultiplier: 1.55, womenFactor: 1.0 },
  { code: 'L4', name: 'Lead', rank: 4, share: 0.13, midMultiplier: 1.9, womenFactor: 0.85 },
  { code: 'L5', name: 'Principal', rank: 5, share: 0.07, midMultiplier: 2.3, womenFactor: 0.7 },
];

const usdPerUnitMicros = (currencyCode: string): number => {
  const rate = FX_RATES.find((r) => r.currencyCode === currencyCode);
  if (!rate) throw new Error(`No FX rate for ${currencyCode}`);
  return rate.usdPerUnitMicros;
};

/** Major-unit rounding step for band figures: 1,000, or 10,000 for INR (02 section 7.4). */
export const bandStep = (currencyCode: string): number => (currencyCode === 'INR' ? 10_000 : 1_000);

const roundTo = (value: number, step: number): number => Math.round(value / step) * step;

// 02 section 7.4: mid from the US L1 midpoint, level multiplier and country pay level; min and
// max at 80% and 120% of mid, all rounded to the band step and stored in minor units.
export function generateBands(): PayBandRow[] {
  const bands: PayBandRow[] = [];
  for (const country of COUNTRIES) {
    const step = bandStep(country.currencyCode);
    const micros = usdPerUnitMicros(country.currencyCode);
    for (const title of JOB_TITLES) {
      for (const level of LEVELS) {
        const midUsd = title.l1MidUsd * level.midMultiplier * country.payLevel;
        const mid = roundTo((midUsd * 1_000_000) / micros, step);
        bands.push({
          countryCode: country.code,
          jobTitleId: title.id,
          levelCode: level.code,
          currencyCode: country.currencyCode,
          minMinor: roundTo(0.8 * mid, step) * 100,
          midMinor: mid * 100,
          maxMinor: roundTo(1.2 * mid, step) * 100,
        });
      }
    }
  }
  return bands;
}

// The seed's reference data and the pure band generator (02 sections 4, 7.3 and 7.4).
export function generateReferenceData(): ReferenceData {
  return {
    fxRates: FX_RATES.map((r) => ({ ...r })),
    countries: COUNTRIES.map(({ code, name, currencyCode }) => ({ code, name, currencyCode })),
    departments: DEPARTMENTS.map((d) => ({ ...d })),
    jobTitles: JOB_TITLES.map(({ id, name, departmentId }) => ({ id, name, departmentId })),
    levels: LEVELS.map(({ code, name, rank }) => ({ code, name, rank })),
    payBands: generateBands(),
  };
}

import type { PayRow } from '../pay-query.ts';

// A complete USD row; each fixture overrides what it exercises.
export function payRow(override: Partial<PayRow> = {}): PayRow {
  return {
    countryCode: 'US',
    departmentId: 1,
    jobTitleId: 1,
    levelCode: 'L2',
    gender: 'female',
    salaryMinor: 1_000_000,
    currency: 'USD',
    usdPerUnitMicros: 1_000_000,
    bandMinMinor: 800_000,
    bandMaxMinor: 1_200_000,
    salaryEffectiveDate: '2025-01-01',
    ...override,
  };
}

// Six salaries in minor units, deliberately unsorted. The expected values are the
// PERCENTILE.INC results (h = (n - 1) * p, linear interpolation) worked out by hand
// and cross-checked against Excel's definition:
//   =PERCENTILE.INC(A1:A6, 0.25) -> 15750   (h = 1.25: 15000 + 0.25 * 3000)
//   =PERCENTILE.INC(A1:A6, 0.5)  -> 19500   (h = 2.5:  18000 + 0.5 * 3000)
//   =PERCENTILE.INC(A1:A6, 0.75) -> 27750   (h = 3.75: 21000 + 0.75 * 9000)
export const EXCEL_SALARIES = [30_000, 12_000, 60_000, 18_000, 15_000, 21_000];

export const EXCEL_PERCENTILES = {
  min: 12_000,
  p25: 15_750,
  median: 19_500,
  p75: 27_750,
  max: 60_000,
} as const;

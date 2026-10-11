import { toUsdMinor } from '@acme/shared';
import { percentile } from './percentiles.ts';

export interface PayRow {
  countryCode: string;
  departmentId: number;
  jobTitleId: number;
  levelCode: string;
  gender: string;
  salaryMinor: number;
  currency: string;
  usdPerUnitMicros: number;
  bandMinMinor: number;
  bandMaxMinor: number;
  salaryEffectiveDate: string;
}

export type Dimension = 'country' | 'department' | 'jobTitle' | 'level' | 'gender';
export type Metric =
  'headcount' | 'total' | 'average' | 'median' | 'p25' | 'p75' | 'min' | 'max' | 'outsideBandCount';

export type PayStats = Partial<
  Record<'total' | 'average' | 'median' | 'p25' | 'p75' | 'min' | 'max', number>
>;

export interface GroupResult {
  key: string;
  label: string;
  // Suppressed groups carry no values (D-012, D-040).
  suppressed: boolean;
  headcount: number | null;
  usd: PayStats | null;
  // Present only when every row in the group has the same currency.
  local: PayStats | null;
  outsideBand: { below: number; above: number; total: number } | null;
}

function statsOf(values: readonly number[], metrics: readonly Metric[]): PayStats {
  const total = values.reduce((sum, v) => sum + v, 0);
  const all: PayStats = {
    total,
    average: Math.round(total / values.length),
    median: Math.round(percentile(values, 0.5)),
    p25: Math.round(percentile(values, 0.25)),
    p75: Math.round(percentile(values, 0.75)),
    min: Math.min(...values),
    max: Math.max(...values),
  };
  const picked: PayStats = {};
  for (const key of Object.keys(all) as (keyof PayStats)[]) {
    if (metrics.includes(key)) picked[key] = all[key];
  }
  return picked;
}

function resultFor(
  key: string,
  label: string,
  rows: readonly PayRow[],
  metrics: readonly Metric[],
): GroupResult {
  const usd = rows.map((r) => toUsdMinor(r.salaryMinor, r.usdPerUnitMicros));
  const singleCurrency = rows.every((r) => r.currency === rows[0]?.currency);
  let outsideBand: GroupResult['outsideBand'] = null;
  if (metrics.includes('outsideBandCount')) {
    const below = rows.filter((r) => r.salaryMinor < r.bandMinMinor).length;
    const above = rows.filter((r) => r.salaryMinor > r.bandMaxMinor).length;
    outsideBand = { below, above, total: below + above };
  }
  return {
    key,
    label,
    suppressed: false,
    headcount: rows.length,
    usd: statsOf(usd, metrics),
    local: singleCurrency
      ? statsOf(
          rows.map((r) => r.salaryMinor),
          metrics,
        )
      : null,
    outsideBand,
  };
}

export function aggregatePay(
  rows: readonly PayRow[],
  metrics: readonly Metric[],
  _groupBy: Dimension | 'none',
  _minGroupSize: number,
  _labels: Readonly<Record<string, string>> = {},
): GroupResult[] {
  return [resultFor('all', 'All active employees', rows, metrics)];
}

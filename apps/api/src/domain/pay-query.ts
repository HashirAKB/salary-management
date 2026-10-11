import { toUsdMinor } from '@acme/shared';
import { GENDERS } from './genders.ts';
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
  | 'headcount'
  | 'total'
  | 'average'
  | 'median'
  | 'p25'
  | 'p75'
  | 'min'
  | 'max'
  | 'outsideBandCount'
  | 'genderGap';

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
  // The currency of a single-currency group; null when mixed or suppressed.
  // Absent on suppressed groups.
  currency?: string | null;
  gap?: GenderGap | null;
}

export interface GenderGap {
  comparable: boolean;
  women: number | null;
  men: number | null;
  gapPct: number | null;
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
    currency: null,
    gap: null,
  };
}

export const KEY_OF: Record<Dimension, (row: PayRow) => string> = {
  country: (r) => r.countryCode,
  department: (r) => String(r.departmentId),
  jobTitle: (r) => String(r.jobTitleId),
  level: (r) => r.levelCode,
  gender: (r) => r.gender,
};

// Levels L1 to L5 sort by rank as codes; genders follow the reference order (genders.ts).
function compareGroups(
  groupBy: Dimension,
  a: { key: string; label: string },
  b: { key: string; label: string },
): number {
  if (groupBy === 'level') return a.key.localeCompare(b.key);
  if (groupBy === 'gender') {
    const order = GENDERS.map((g) => g.code);
    return order.indexOf(a.key) - order.indexOf(b.key);
  }
  return a.label.localeCompare(b.label);
}

function suppressedResult(key: string, label: string): GroupResult {
  return {
    key,
    label,
    suppressed: true,
    headcount: null,
    usd: null,
    local: null,
    outsideBand: null,
  };
}

export function aggregatePay(
  rows: readonly PayRow[],
  metrics: readonly Metric[],
  groupBy: Dimension | 'none',
  minGroupSize: number,
  labels: Readonly<Record<string, string>> = {},
): GroupResult[] {
  if (rows.length === 0) return [];
  if (groupBy === 'none') {
    const label = 'All active employees';
    return [
      rows.length < minGroupSize
        ? suppressedResult('all', label)
        : resultFor('all', label, rows, metrics),
    ];
  }

  const byKey = new Map<string, PayRow[]>();
  for (const row of rows) {
    const key = KEY_OF[groupBy](row);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }

  const groups = [...byKey.entries()].map(([key, groupRows]) => {
    const label = labels[key] ?? key;
    return {
      key,
      label,
      rows: groupRows,
      suppressed: groupRows.length < minGroupSize,
    };
  });

  // D-071: with one group hidden, Finance could subtract the visible groups from the total and
  // recover it, so the smallest visible group (ties by key) is hidden too.
  const hidden = groups.filter((g) => g.suppressed);
  if (hidden.length === 1) {
    const [smallest] = groups
      .filter((g) => !g.suppressed)
      .sort((a, b) => a.rows.length - b.rows.length || a.key.localeCompare(b.key));
    if (smallest) smallest.suppressed = true;
  }

  return groups
    .map((g) =>
      g.suppressed ? suppressedResult(g.key, g.label) : resultFor(g.key, g.label, g.rows, metrics),
    )
    .sort((a, b) => compareGroups(groupBy, a, b));
}

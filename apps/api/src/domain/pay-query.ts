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

export function aggregatePay(
  _rows: readonly PayRow[],
  _metrics: readonly Metric[],
  _groupBy: Dimension | 'none',
  _minGroupSize: number,
): GroupResult[] {
  throw new Error('not implemented');
}

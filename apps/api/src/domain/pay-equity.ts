import type { PayRow } from './pay-query.ts';

export interface Cohort {
  countryCode: string;
  jobTitleId: number;
  levelCode: string;
  comparable: boolean;
  women: number | null;
  men: number | null;
  // Mean pay in the cohort's local currency, minor units; null when not comparable.
  meanWomenMinor: number | null;
  meanMenMinor: number | null;
  currency: string;
  gapPct: number | null;
  flagged: boolean;
}

export interface OrgGap {
  meanGapPct: number | null;
  medianGapPct: number | null;
  women: number;
  men: number;
}

export interface PayEquityResult {
  org: OrgGap;
  cohorts: Cohort[];
}

export const FLAG_THRESHOLD_PCT = 5;
export const MIN_PER_GENDER = 5;

export function computePayEquity(_rows: readonly PayRow[]): PayEquityResult {
  throw new Error('not implemented');
}

import { gapPct, toUsdMinor } from '@acme/shared';
import { percentile } from './percentiles.ts';
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

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

function meanOf(values: readonly number[]): number {
  return Math.round(sum(values) / values.length);
}

// Flag on the unrounded gap: (sumMen / nMen - sumWomen / nWomen) / (sumMen / nMen) >= 5%.
// Cross-multiplied in BigInt so no rounding or float error can move a 4.99% gap to 5%.
function isFlagged(men: readonly number[], women: readonly number[]): boolean {
  const sumMen = BigInt(sum(men));
  const sumWomen = BigInt(sum(women));
  const nMen = BigInt(men.length);
  const nWomen = BigInt(women.length);
  const menScaled = sumMen * nWomen;
  const womenScaled = sumWomen * nMen;
  return (menScaled - womenScaled) * 100n >= BigInt(FLAG_THRESHOLD_PCT) * menScaled;
}

function cohortOf(rows: readonly PayRow[]): Cohort {
  const first = rows[0]!;
  const women = rows.filter((r) => r.gender === 'female').map((r) => r.salaryMinor);
  const men = rows.filter((r) => r.gender === 'male').map((r) => r.salaryMinor);
  const base = {
    countryCode: first.countryCode,
    jobTitleId: first.jobTitleId,
    levelCode: first.levelCode,
    currency: first.currency,
  };
  if (women.length < MIN_PER_GENDER || men.length < MIN_PER_GENDER) {
    return {
      ...base,
      comparable: false,
      women: null,
      men: null,
      meanWomenMinor: null,
      meanMenMinor: null,
      gapPct: null,
      flagged: false,
    };
  }
  const meanWomenMinor = meanOf(women);
  const meanMenMinor = meanOf(men);
  return {
    ...base,
    comparable: true,
    women: women.length,
    men: men.length,
    meanWomenMinor,
    meanMenMinor,
    gapPct: gapPct(meanMenMinor, meanWomenMinor),
    flagged: isFlagged(men, women),
  };
}

function orgGap(rows: readonly PayRow[]): OrgGap {
  const usdOf = (gender: string) =>
    rows
      .filter((r) => r.gender === gender)
      .map((r) => toUsdMinor(r.salaryMinor, r.usdPerUnitMicros));
  const women = usdOf('female');
  const men = usdOf('male');
  const both = women.length > 0 && men.length > 0;
  return {
    meanGapPct: both ? gapPct(meanOf(men), meanOf(women)) : null,
    medianGapPct: both
      ? gapPct(Math.round(percentile(men, 0.5)), Math.round(percentile(women, 0.5)))
      : null,
    women: women.length,
    men: men.length,
  };
}

// Cohort = country + job title + level (D-013); means stay in local currency.
export function computePayEquity(rows: readonly PayRow[]): PayEquityResult {
  const byCohort = new Map<string, PayRow[]>();
  for (const row of rows) {
    const key = `${row.countryCode}|${row.jobTitleId}|${row.levelCode}`;
    byCohort.set(key, [...(byCohort.get(key) ?? []), row]);
  }
  const cohorts = [...byCohort.values()]
    .map(cohortOf)
    .sort(
      (a, b) =>
        a.countryCode.localeCompare(b.countryCode) ||
        a.jobTitleId - b.jobTitleId ||
        a.levelCode.localeCompare(b.levelCode),
    );
  return { org: orgGap(rows), cohorts };
}

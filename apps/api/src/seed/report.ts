import { toUsdMinor } from '@acme/shared';
import type { LevelCode } from '../db/schema.ts';
import type { Dataset, EmployeeRow, SeedConfig } from './generate.ts';

export type CohortGap = {
  countryCode: string;
  jobTitle: string;
  levelCode: LevelCode;
  women: number;
  men: number;
  /** Null when the cohort has fewer than 5 women or 5 men. */
  gapPct: number | null;
  flagged: boolean;
};

export type SeedReport = {
  active: number;
  terminated: number;
  activeByCountry: Record<string, number>;
  terminatedByCountry: Record<string, number>;
  historyRows: number;
  outsideBand: { below: number; above: number };
  noChangeSince20240930: number;
  targetCohorts: CohortGap[];
  eligibleCohorts: number;
  bandCount: number;
  orgGapUsd: { meanPct: number; medianPct: number };
  groupsUnder5: number;
};

const STALE_SINCE = '2024-09-30';
const MIN_GROUP = 5;
const FLAG_AT_PCT = 5; // D-013

const key = (countryCode: string, jobTitleId: number, levelCode: string) =>
  `${countryCode}/${jobTitleId}/${levelCode}`;

const countBy = (rows: EmployeeRow[], by: (e: EmployeeRow) => string) => {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[by(row)] = (counts[by(row)] ?? 0) + 1;
  return counts;
};

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

// Linear interpolation at p = 0.5 (D-024).
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) / 2;
  const lo = sorted[Math.floor(h)] ?? 0;
  const hi = sorted[Math.ceil(h)] ?? lo;
  return lo + (h - Math.floor(h)) * (hi - lo);
};

// 02 section 4: positive means women are paid less.
const gapPct = (men: number, women: number) => ((men - women) / men) * 100;

// The summary printed after seeding (02 section 7.11). Insight figures cover active employees.
export function seedReport(dataset: Dataset, config: SeedConfig): SeedReport {
  const active = dataset.employees.filter((e) => e.status === 'active');
  const terminated = dataset.employees.filter((e) => e.status === 'terminated');
  const bands = new Map(
    dataset.payBands.map((b) => [key(b.countryCode, b.jobTitleId, b.levelCode), b]),
  );
  const fx = new Map(dataset.fxRates.map((r) => [r.currencyCode, r.usdPerUnitMicros]));
  const titleName = new Map(dataset.jobTitles.map((t) => [t.id, t.name]));

  const outsideBand = { below: 0, above: 0 };
  const cohorts = new Map<string, EmployeeRow[]>();
  for (const e of active) {
    const band = bands.get(key(e.countryCode, e.jobTitleId, e.levelCode));
    if (band && e.salaryMinor < band.minMinor) outsideBand.below++;
    if (band && e.salaryMinor > band.maxMinor) outsideBand.above++;
    const k = key(e.countryCode, e.jobTitleId, e.levelCode);
    cohorts.set(k, [...(cohorts.get(k) ?? []), e]);
  }

  const cohortGap = (members: EmployeeRow[]) => {
    const women = members.filter((e) => e.gender === 'female').map((e) => e.salaryMinor);
    const men = members.filter((e) => e.gender === 'male').map((e) => e.salaryMinor);
    const eligible = women.length >= MIN_GROUP && men.length >= MIN_GROUP;
    const gap = eligible ? gapPct(mean(men), mean(women)) : null;
    return {
      women: women.length,
      men: men.length,
      gapPct: gap,
      flagged: gap !== null && gap >= FLAG_AT_PCT,
    };
  };

  const usd = (e: EmployeeRow) => toUsdMinor(e.salaryMinor, fx.get(e.salaryCurrency) ?? 0);
  const womenUsd = active.filter((e) => e.gender === 'female').map(usd);
  const menUsd = active.filter((e) => e.gender === 'male').map(usd);

  return {
    active: active.length,
    terminated: terminated.length,
    activeByCountry: countBy(active, (e) => e.countryCode),
    terminatedByCountry: countBy(terminated, (e) => e.countryCode),
    historyRows: dataset.salaryChanges.length,
    outsideBand,
    noChangeSince20240930: active.filter((e) => e.salaryEffectiveDate < STALE_SINCE).length,
    targetCohorts: config.gapTargets.map((t) => ({
      countryCode: t.countryCode,
      jobTitle: titleName.get(t.jobTitleId) ?? String(t.jobTitleId),
      levelCode: t.levelCode,
      ...cohortGap(cohorts.get(key(t.countryCode, t.jobTitleId, t.levelCode)) ?? []),
    })),
    eligibleCohorts: [...cohorts.values()].filter((m) => cohortGap(m).gapPct !== null).length,
    bandCount: dataset.payBands.length,
    orgGapUsd: {
      meanPct: gapPct(mean(menUsd), mean(womenUsd)),
      medianPct: gapPct(median(menUsd), median(womenUsd)),
    },
    groupsUnder5: [...cohorts.values()].filter((m) => m.length < MIN_GROUP).length,
  };
}

const byCountry = (counts: Record<string, number>) =>
  Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, n]) => `${country} ${n}`)
    .join(', ');

export function formatSeedReport(r: SeedReport): string {
  const cohortLine = (c: CohortGap) =>
    `  ${c.countryCode} / ${c.jobTitle} / ${c.levelCode}: ` +
    (c.gapPct === null
      ? `not eligible, ${c.women} women, ${c.men} men`
      : `gap ${c.gapPct.toFixed(1)}%${c.flagged ? ' (flagged)' : ''}, ${c.women} women, ${c.men} men`);
  return [
    'Seed report',
    `Active employees: ${r.active} (${byCountry(r.activeByCountry)})`,
    `Terminated employees: ${r.terminated} (${byCountry(r.terminatedByCountry)})`,
    `Salary history rows: ${r.historyRows}`,
    `Outside band: ${r.outsideBand.below + r.outsideBand.above} (below ${r.outsideBand.below}, above ${r.outsideBand.above})`,
    `No salary change since ${STALE_SINCE}: ${r.noChangeSince20240930}`,
    'Target cohorts:',
    ...r.targetCohorts.map(cohortLine),
    `Eligible cohorts (${MIN_GROUP}+ women and ${MIN_GROUP}+ men): ${r.eligibleCohorts} of ${r.bandCount}`,
    `Org-wide gender gap in USD: mean ${r.orgGapUsd.meanPct.toFixed(1)}%, median ${r.orgGapUsd.medianPct.toFixed(1)}%`,
    `Groups with fewer than ${MIN_GROUP} people: ${r.groupsUnder5}`,
  ].join('\n');
}

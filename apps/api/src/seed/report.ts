import type { LevelCode } from '../db/schema.ts';
import type { Dataset, SeedConfig } from './generate.ts';

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

export function seedReport(_dataset: Dataset, _config: SeedConfig): SeedReport {
  throw new Error('not implemented');
}

export function formatSeedReport(_report: SeedReport): string {
  throw new Error('not implemented');
}

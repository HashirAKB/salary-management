import type {
  InsightsSummaryResponse,
  Money,
  PayDistributionQuery,
  PayDistributionResponse,
} from '@acme/shared';
import type { Db } from '../../db/client.ts';
import type { Role } from '../../db/schema.ts';
import { aggregateMinGroupSize } from '../../domain/permissions.ts';
import { aggregatePay, KEY_OF, type Metric, type PayStats } from '../../domain/pay-query.ts';
import { fxAsOf } from '../auth/sessions.ts';
import { checkListValues } from '../employees/service.ts';
import { loadActivePayRows, loadCountryNames, loadGroupLabels } from './repo.ts';

const SUMMARY_METRICS: Metric[] = ['headcount', 'total', 'outsideBandCount'];

// Today minus two years, the same date SQLite's date(today, '-2 years') gives.
function twoYearsBefore(today: string): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 2);
  return date.toISOString().slice(0, 10);
}

const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' });

// I1 (04 section 5.6): one projection, the engine run twice (none, country).
export async function getSummary(
  db: Db,
  viewer: { role: Role },
  today: string,
): Promise<InsightsSummaryResponse> {
  const [rows, countryNames, asOf] = await Promise.all([
    loadActivePayRows(db),
    loadCountryNames(db),
    fxAsOf(db),
  ]);
  const minSize = aggregateMinGroupSize(viewer.role);
  const [all] = aggregatePay(rows, SUMMARY_METRICS, 'none', minSize);
  const countries = aggregatePay(rows, SUMMARY_METRICS, 'country', minSize, countryNames);
  const currencyOf = new Map(rows.map((r) => [r.countryCode, r.currency]));
  const since = twoYearsBefore(today);

  return {
    fxAsOf: asOf,
    headcount: all?.headcount ?? 0,
    payrollUsd: usd(all?.usd?.total ?? 0),
    byCountry: countries.map((group) => ({
      country: { code: group.key, name: group.label },
      headcount: group.headcount,
      suppressed: group.suppressed,
      payrollLocal: group.local
        ? { amountMinor: group.local.total!, currency: currencyOf.get(group.key)! }
        : null,
      payrollUsd: group.usd ? usd(group.usd.total!) : null,
    })),
    outsideBand: all?.outsideBand ?? { below: 0, above: 0, total: 0 },
    staleSalaries: {
      since,
      count: rows.filter((r) => r.salaryEffectiveDate < since).length,
    },
  };
}

const DISTRIBUTION_METRICS: Metric[] = [
  'headcount',
  'min',
  'p25',
  'median',
  'p75',
  'max',
  'average',
  'total',
];

function moneyStats(stats: PayStats, currency: string) {
  const money = (amountMinor: number | undefined): Money => ({
    amountMinor: amountMinor!,
    currency,
  });
  return {
    min: money(stats.min),
    p25: money(stats.p25),
    median: money(stats.median),
    p75: money(stats.p75),
    max: money(stats.max),
    average: money(stats.average),
    total: money(stats.total),
  };
}

// I2 (04 section 5.6): filters in SQL, then the engine once for the chosen dimension.
export async function getPayDistribution(
  db: Db,
  viewer: { role: Role },
  query: PayDistributionQuery,
): Promise<PayDistributionResponse> {
  await checkListValues(db, query);
  const filters = {
    countries: query.country ?? [],
    departmentIds: (query.department ?? []).map(Number),
    jobTitleIds: (query.jobTitle ?? []).map(Number),
    levelCodes: query.level ?? [],
    genders: query.gender ?? [],
  };
  const { groupBy } = query;
  const [rows, labels, asOf] = await Promise.all([
    loadActivePayRows(db, filters),
    groupBy === 'none' ? Promise.resolve({}) : loadGroupLabels(db, groupBy),
    fxAsOf(db),
  ]);
  const groups = aggregatePay(
    rows,
    DISTRIBUTION_METRICS,
    groupBy,
    aggregateMinGroupSize(viewer.role),
    labels,
  );
  const currencyOf = new Map(
    rows.map((r) => [groupBy === 'none' ? 'all' : KEY_OF[groupBy](r), r.currency]),
  );

  return {
    fxAsOf: asOf,
    groupBy,
    filters,
    groups: groups.map((group) => ({
      key: group.key,
      label: group.label,
      headcount: group.headcount,
      suppressed: group.suppressed,
      usd: group.usd ? moneyStats(group.usd, 'USD') : null,
      local: group.local ? moneyStats(group.local, currencyOf.get(group.key)!) : null,
    })),
  };
}

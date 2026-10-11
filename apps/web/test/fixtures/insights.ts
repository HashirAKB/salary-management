import {
  insightsSummaryResponseSchema,
  payDistributionResponseSchema,
  payEquityResponseSchema,
  type InsightsSummaryResponse,
  type PayDistributionResponse,
  type PayEquityResponse,
} from '@acme/shared';

// Fixture builders parse with the shared response schema (D-050).
const usd = (amountMinor: number) => ({ amountMinor, currency: 'USD' });

export const aSummaryResponse = (
  overrides: Partial<InsightsSummaryResponse> = {},
): InsightsSummaryResponse =>
  insightsSummaryResponseSchema.parse({
    fxAsOf: '2026-09-30',
    headcount: 1200,
    payrollUsd: usd(100_000_000),
    byCountry: [
      {
        country: { code: 'US', name: 'United States' },
        headcount: 1100,
        suppressed: false,
        payrollLocal: usd(99_000_000),
        payrollUsd: usd(99_000_000),
      },
      {
        country: { code: 'DE', name: 'Germany' },
        headcount: 1,
        suppressed: false,
        payrollLocal: { amountMinor: 3_600, currency: 'EUR' },
        payrollUsd: usd(4_000),
      },
      {
        country: { code: 'IN', name: 'India' },
        headcount: null,
        suppressed: true,
        payrollLocal: null,
        payrollUsd: null,
      },
    ],
    outsideBand: { below: 281, above: 279, total: 560 },
    staleSalaries: { since: '2024-10-09', count: 1234 },
    ...overrides,
  });

const stats = (median: number) => ({
  min: usd(median - 20_000),
  p25: usd(median - 10_000),
  median: usd(median),
  p75: usd(median + 10_000),
  max: usd(median + 20_000),
  average: usd(median + 500),
  total: usd(median * 10),
});

const FILTERS = { countries: [], departmentIds: [], jobTitleIds: [], levelCodes: [], genders: [] };

export const aDistributionResponse = (
  overrides: Partial<PayDistributionResponse> = {},
): PayDistributionResponse =>
  payDistributionResponseSchema.parse({
    fxAsOf: '2026-09-30',
    groupBy: 'country',
    filters: FILTERS,
    groups: [
      {
        key: 'US',
        label: 'United States',
        headcount: 1100,
        suppressed: false,
        usd: stats(9_000_000),
        local: stats(9_000_000),
      },
      { key: 'IN', label: 'India', headcount: null, suppressed: true, usd: null, local: null },
    ],
    ...overrides,
  });

export const aPayEquityResponse = (overrides: Partial<PayEquityResponse> = {}): PayEquityResponse =>
  payEquityResponseSchema.parse({
    fxAsOf: '2026-09-30',
    thresholdPct: 5,
    minPerGender: 5,
    org: { meanGapPct: 8, medianGapPct: 0, women: 400, men: 800, basis: 'usd' },
    cohortCounts: { withEmployees: 250, comparable: 171, flagged: 3 },
    cohorts: [
      {
        country: { code: 'US', name: 'United States' },
        jobTitle: { id: 1, name: 'Software Engineer' },
        level: { code: 'L3', name: 'Senior' },
        comparable: true,
        women: 12,
        men: 30,
        meanWomen: usd(14_000_000),
        meanMen: usd(15_000_000),
        gapPct: 6.7,
        flagged: true,
      },
      {
        country: { code: 'DE', name: 'Germany' },
        jobTitle: { id: 3, name: 'Product Designer' },
        level: { code: 'L2', name: 'Mid' },
        comparable: false,
        women: null,
        men: null,
        meanWomen: null,
        meanMen: null,
        gapPct: null,
        flagged: false,
      },
    ],
    ...overrides,
  });

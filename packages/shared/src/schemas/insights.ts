import { z } from 'zod';
import { isoDateSchema } from './common.ts';
import { commaList, moneySchema } from './employee.ts';

const countrySchema = z.object({ code: z.string(), name: z.string() });

// I1 (04 section 5.6). A suppressed country (Finance, under 5 people) has null numbers (D-012).
export const insightsSummaryQuerySchema = z.strictObject({});

export const insightsSummaryResponseSchema = z.object({
  fxAsOf: isoDateSchema,
  headcount: z.number().int(),
  payrollUsd: moneySchema,
  byCountry: z.array(
    z.object({
      country: countrySchema,
      headcount: z.number().int().nullable(),
      suppressed: z.boolean(),
      payrollLocal: moneySchema.nullable(),
      payrollUsd: moneySchema.nullable(),
    }),
  ),
  outsideBand: z.object({
    below: z.number().int(),
    above: z.number().int(),
    total: z.number().int(),
  }),
  staleSalaries: z.object({ since: isoDateSchema, count: z.number().int() }),
});

export type InsightsSummaryResponse = z.infer<typeof insightsSummaryResponseSchema>;

// I2 (04 section 5.6). Lists are comma-separated as in E1.
export const PAY_DISTRIBUTION_GROUPS = [
  'none',
  'country',
  'department',
  'jobTitle',
  'level',
  'gender',
] as const;

export const payDistributionQuerySchema = z.strictObject({
  groupBy: z.enum(PAY_DISTRIBUTION_GROUPS).default('country'),
  country: commaList.optional(),
  department: commaList.optional(),
  jobTitle: commaList.optional(),
  level: commaList.optional(),
  gender: commaList.optional(),
});

export type PayDistributionQuery = z.infer<typeof payDistributionQuerySchema>;

const payStatsSchema = z.object({
  min: moneySchema,
  p25: moneySchema,
  median: moneySchema,
  p75: moneySchema,
  max: moneySchema,
  average: moneySchema,
  total: moneySchema,
});

export const payDistributionResponseSchema = z.object({
  fxAsOf: isoDateSchema,
  groupBy: z.enum(PAY_DISTRIBUTION_GROUPS),
  filters: z.object({
    countries: z.array(z.string()),
    departmentIds: z.array(z.number().int()),
    jobTitleIds: z.array(z.number().int()),
    levelCodes: z.array(z.string()),
    genders: z.array(z.string()),
  }),
  groups: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      headcount: z.number().int().nullable(),
      suppressed: z.boolean(),
      usd: payStatsSchema.nullable(),
      local: payStatsSchema.nullable(),
    }),
  ),
});

export type PayDistributionResponse = z.infer<typeof payDistributionResponseSchema>;

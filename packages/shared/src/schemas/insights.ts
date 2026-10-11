import { z } from 'zod';
import { isoDateSchema } from './common.ts';
import { moneySchema } from './employee.ts';

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

import { z } from 'zod';
import { isoDateSchema } from './common.ts';
import { moneySchema } from './employee.ts';

// 04 section 4.7: the four reasons a user can pick; `hire` is written by the system only.
export const salaryChangeReasonSchema = z.enum([
  'merit',
  'promotion',
  'market_adjustment',
  'correction',
]);

export type SalaryChangeReason = z.infer<typeof salaryChangeReasonSchema>;

// 04 section 5.5 S2 body.
export const salaryChangeBodySchema = z.strictObject({
  effectiveDate: isoDateSchema,
  reason: salaryChangeReasonSchema,
  amount: z.strictObject({
    amountMinor: z.number().int().min(1).max(1_000_000_000_000),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  jobTitleId: z.number().int().min(1),
  levelCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5']),
});

export type SalaryChangeBody = z.infer<typeof salaryChangeBodySchema>;

const levelRefSchema = z.object({ code: z.string(), name: z.string() });
const titleRefSchema = z.object({ id: z.number().int(), name: z.string() });

// 04 section 5.5 S1: one history row with the values before it (null on the hire row).
export const salaryChangeItemSchema = z.object({
  id: z.number().int(),
  effectiveDate: isoDateSchema,
  reason: z.enum(['hire', 'promotion', 'merit', 'market_adjustment', 'correction']),
  amount: moneySchema,
  previousAmount: moneySchema.nullable(),
  changePct: z.number().nullable(),
  jobTitle: titleRefSchema,
  level: levelRefSchema,
  previousJobTitle: titleRefSchema.nullable(),
  previousLevel: levelRefSchema.nullable(),
  changedBy: z.object({ displayName: z.string() }).nullable(),
  createdAt: z.string(),
});

export type SalaryChangeItem = z.infer<typeof salaryChangeItemSchema>;

export const salaryHistoryResponseSchema = z.object({ items: z.array(salaryChangeItemSchema) });

export type SalaryHistoryResponse = z.infer<typeof salaryHistoryResponseSchema>;

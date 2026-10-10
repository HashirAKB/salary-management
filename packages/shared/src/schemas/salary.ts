import { z } from 'zod';
import { isoDateSchema } from './common.ts';

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

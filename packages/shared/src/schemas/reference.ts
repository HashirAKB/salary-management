import { z } from 'zod';
import { isoDateSchema } from './common.ts';
import { moneySchema } from './employee.ts';

const codeName = z.object({ code: z.string(), name: z.string() });

// R1 (04 section 5.3).
export const referenceResponseSchema = z.object({
  countries: z.array(codeName.extend({ currency: z.string() })),
  departments: z.array(z.object({ id: z.number().int(), name: z.string() })),
  jobTitles: z.array(
    z.object({ id: z.number().int(), name: z.string(), departmentId: z.number().int() }),
  ),
  levels: z.array(codeName.extend({ rank: z.number().int() })),
  genders: z.array(codeName),
  salaryChangeReasons: z.array(codeName),
  fx: z.object({
    asOfDate: isoDateSchema,
    // A display string built from the micros, for example "0.011500"; never used in arithmetic.
    rates: z.array(z.object({ currency: z.string(), usdPerUnit: z.string() })),
  }),
});

export type ReferenceResponse = z.infer<typeof referenceResponseSchema>;

// R2 (04 section 5.3).
export const payBandParamsSchema = z.strictObject({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  jobTitleId: z.coerce.number().int().min(1),
  levelCode: z.enum(['L1', 'L2', 'L3', 'L4', 'L5']),
});

export const payBandResponseSchema = z.object({
  countryCode: z.string(),
  jobTitleId: z.number().int(),
  levelCode: z.string(),
  min: moneySchema,
  mid: moneySchema,
  max: moneySchema,
});

export type PayBandResponse = z.infer<typeof payBandResponseSchema>;

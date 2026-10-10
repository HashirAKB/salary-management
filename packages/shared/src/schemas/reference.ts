import { z } from 'zod';
import { isoDateSchema } from './common.ts';

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

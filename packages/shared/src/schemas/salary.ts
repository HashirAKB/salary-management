import { z } from 'zod';

export const salaryChangeBodySchema = z.strictObject({});

export type SalaryChangeBody = z.infer<typeof salaryChangeBodySchema>;

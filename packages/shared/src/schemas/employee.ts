import { z } from 'zod';

// 04 section 5.4 E1 query, S3 subset. Strict: S4 adds the filters, sort and `q`.
export const employeeListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]))
    .default(50),
  status: z.enum(['active', 'terminated', 'all']).default('active'),
});

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

import { z } from 'zod';
import { isoDateSchema } from './common.ts';

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

const codeName = z.object({ code: z.string(), name: z.string() });
const idName = z.object({ id: z.number().int(), name: z.string() });

export const moneySchema = z.object({ amountMinor: z.number().int(), currency: z.string() });

// 04 section 5.4 E1 item. Local salary only; USD, compa-ratio and band position come with the
// next cycle.
export const employeeListItemSchema = z.object({
  id: z.number().int(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.enum(['female', 'male', 'non_binary', 'not_disclosed']),
  country: codeName,
  department: idName,
  jobTitle: idName,
  level: codeName,
  status: z.enum(['active', 'terminated']),
  hireDate: isoDateSchema,
  terminationDate: isoDateSchema.nullable(),
  salary: moneySchema,
  salaryEffectiveDate: isoDateSchema,
});

export const employeeListResponseSchema = z.object({
  items: z.array(employeeListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  fxAsOf: isoDateSchema,
});

export type EmployeeListItem = z.infer<typeof employeeListItemSchema>;
export type EmployeeListResponse = z.infer<typeof employeeListResponseSchema>;

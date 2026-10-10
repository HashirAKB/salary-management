import { z } from 'zod';
import { isoDateSchema } from './common.ts';

// 04 section 4.6: a list is one comma-separated param; trim, drop empties, de-duplicate.
// Shape only: whether a country or level exists is checked against the reference tables.
const commaList = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? [
          ...new Set(
            value
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item !== ''),
          ),
        ]
      : value,
  z.array(z.string()),
);

// 04 section 5.4 E1 query.
export const employeeListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]))
    .default(50),
  status: z.enum(['active', 'terminated', 'all']).default('active'),
  q: z.string().trim().min(1).max(100).optional(),
  country: commaList.optional(),
  department: commaList.optional(),
  jobTitle: commaList.optional(),
  level: commaList.optional(),
  gender: commaList.optional(),
  band: z.enum(['below', 'above', 'outside', 'inside']).optional(),
  salaryUnchangedSince: isoDateSchema.optional(),
  sort: z.enum(['name', 'salaryUsd', 'hireDate']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

const LIST_KEYS = ['country', 'department', 'jobTitle', 'level', 'gender'] as const;
const SCALAR_KEYS = ['q', 'band', 'salaryUnchangedSince', 'sort', 'order'] as const;

/** Query string (no leading `?`) for a parsed query; defaults and empty lists are left out. */
export function serializeEmployeeListQuery(query: EmployeeListQuery): string {
  const parts: string[] = [];
  if (query.page !== 1) parts.push(`page=${query.page}`);
  if (query.pageSize !== 50) parts.push(`pageSize=${query.pageSize}`);
  if (query.status !== 'active') parts.push(`status=${query.status}`);
  for (const key of SCALAR_KEYS) {
    const value = query[key];
    if (value !== undefined) parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  for (const key of LIST_KEYS) {
    const values = query[key];
    if (values !== undefined && values.length > 0) {
      parts.push(`${key}=${values.map(encodeURIComponent).join(',')}`);
    }
  }
  return parts.join('&');
}

const codeName = z.object({ code: z.string(), name: z.string() });
const idName = z.object({ id: z.number().int(), name: z.string() });

export const moneySchema = z.object({ amountMinor: z.number().int(), currency: z.string() });

export const bandPositionSchema = z.enum(['below', 'inside', 'above']);

// 04 section 5.4 E1 item.
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
  salaryUsd: moneySchema,
  salaryEffectiveDate: isoDateSchema,
  compaRatio: z.number(),
  bandPosition: bandPositionSchema,
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

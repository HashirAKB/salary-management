import { z } from 'zod';

// 04 section 4.4: the complete error code catalogue.
export const errorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'EMPLOYEE_NOT_FOUND',
  'PAY_BAND_NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'UNSUPPORTED_MEDIA_TYPE',
  'NO_PAY_BAND',
  'SALARY_CURRENCY_MISMATCH',
  'SALARY_DATE_BEFORE_CURRENT',
  'DATE_IN_FUTURE',
  'RAISE_REQUIRED',
  'POSITION_MUST_NOT_CHANGE',
  'PROMOTION_LEVEL_NOT_HIGHER',
  'CORRECTION_NO_CHANGE',
  'EMPLOYEE_TERMINATED',
  'EMPLOYEE_ALREADY_TERMINATED',
  'TERMINATION_BEFORE_HIRE',
  'RATE_LIMITED',
  'ASK_LIMIT_REACHED',
  'ASK_UNAVAILABLE',
  'ASK_UPSTREAM_FAILED',
  'DB_UNAVAILABLE',
  'INTERNAL',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

// RFC 9457 problem details (04 section 4.4).
export const problemSchema = z.object({
  type: z.literal('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  code: errorCodeSchema,
  instance: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export type Problem = z.infer<typeof problemSchema>;

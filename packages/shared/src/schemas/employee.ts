import type { z } from 'zod';

export type EmployeeListQuery = {
  page: number;
  pageSize: 25 | 50 | 100;
  status: 'active' | 'terminated' | 'all';
};

// 04 section 5.4 E1 query, S3 subset. Stub until the green commit.
export const employeeListQuerySchema = {
  safeParse(_input: unknown): z.ZodSafeParseResult<EmployeeListQuery> {
    throw new Error('not implemented');
  },
};

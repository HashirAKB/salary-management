import type { EmployeeListQuery, EmployeeListResponse } from '@acme/shared';
import type { Db } from '../../db/client.ts';

// E1 (04 section 5.4).
export async function listEmployees(
  _db: Db,
  _query: EmployeeListQuery,
): Promise<EmployeeListResponse> {
  throw new Error('not implemented');
}

import type { InsightsSummaryResponse } from '@acme/shared';
import type { Db } from '../../db/client.ts';
import type { Role } from '../../db/schema.ts';

export async function getSummary(
  _db: Db,
  _viewer: { role: Role },
  _today: string,
): Promise<InsightsSummaryResponse> {
  throw new Error('not implemented');
}

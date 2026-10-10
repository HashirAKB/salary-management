import type { SQL, SQLWrapper } from 'drizzle-orm';

export function usdMinorSql(_amountMinor: SQLWrapper, _usdPerUnitMicros: SQLWrapper): SQL<number> {
  throw new Error('not implemented');
}

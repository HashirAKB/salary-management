import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

// The SQL form of toUsdMinor for sorting by USD (02 section 4). Integer division of positive
// integers gives the same half-up result as Math.round in TypeScript.
export function usdMinorSql(amountMinor: SQLWrapper, usdPerUnitMicros: SQLWrapper): SQL<number> {
  return sql<number>`((${amountMinor} * ${usdPerUnitMicros} + 500000) / 1000000)`;
}

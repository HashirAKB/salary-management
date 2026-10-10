import { toUsdMinor } from '@acme/shared';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from './client.ts';
import { usdMinorSql } from './money-sql.ts';

const cases = [
  { amountMinor: 9_500_000, micros: 1_000_000 },
  { amountMinor: 100, micros: 1_340_000 },
  { amountMinor: 12_345, micros: 1_160_000 },
  { amountMinor: 50, micros: 1_010_000 },
  { amountMinor: 50, micros: 11_500 },
  { amountMinor: 130, micros: 11_500 },
  { amountMinor: 1_500_000_000, micros: 11_500 },
  { amountMinor: 7_654_321, micros: 720_000 },
];

describe('usdMinorSql', () => {
  it('the SQL conversion form agrees with toUsdMinor (02 section 4)', async () => {
    const db = createDb(':memory:');
    // Integer literals, as stored in the INTEGER columns salary_minor and usd_per_unit_micros.
    const values = sql.raw(cases.map((c) => `(${c.amountMinor}, ${c.micros})`).join(', '));

    const rows = await db.all<{ usd: number }>(
      sql`WITH v(amount_minor, micros) AS (VALUES ${values})
          SELECT ${usdMinorSql(sql`amount_minor`, sql`micros`)} AS usd FROM v`,
    );

    expect(rows.map((row) => row.usd)).toEqual(
      cases.map((c) => toUsdMinor(c.amountMinor, c.micros)),
    );
  });
});

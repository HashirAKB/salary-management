import type { Db } from '../../src/db/client.ts';

/** A database handle or a transaction handle: builders insert through whichever they're given. */
export type DbOrTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

/** The next sequential id for a table, so ids follow insert order within a test (05 section 4.2). */
export async function nextId(db: DbOrTx, table: string): Promise<number> {
  const rows = await db.all<{ next: number }>(
    `SELECT coalesce(max(id), 0) + 1 AS next FROM ${table}`,
  );
  return rows[0]?.next ?? 1;
}

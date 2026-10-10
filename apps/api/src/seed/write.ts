import { sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Db } from '../db/client.ts';
import {
  askLog,
  countries,
  departments,
  employees,
  fxRates,
  jobTitles,
  levels,
  payBands,
  salaryChanges,
  sessions,
  users,
  type Role,
} from '../db/schema.ts';
import type { Dataset } from './generate.ts';

export type SeedUser = {
  email: string;
  displayName: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
};

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// 500 rows per INSERT keeps employees (17 columns) under SQLite's bound-parameter limit (02 section 7.1).
const CHUNK = 500;

async function insertChunked<T extends SQLiteTable>(
  tx: Tx,
  table: T,
  rows: readonly T['$inferInsert'][],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await tx.insert(table).values(rows.slice(i, i + CHUNK));
  }
}

// 02 section 7.10: one write transaction resets, inserts the dataset and upserts the users by
// email. Inside it only the transaction handle is used (05 section 4.1).
export async function writeDataset(db: Db, dataset: Dataset, seedUsers: SeedUser[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of [
      askLog,
      sessions,
      salaryChanges,
      employees,
      payBands,
      jobTitles,
      departments,
      levels,
      countries,
      fxRates,
    ]) {
      await tx.delete(table);
    }
    await insertChunked(tx, fxRates, dataset.fxRates);
    await insertChunked(tx, countries, dataset.countries);
    await insertChunked(tx, departments, dataset.departments);
    await insertChunked(tx, jobTitles, dataset.jobTitles);
    await insertChunked(tx, levels, dataset.levels);
    await insertChunked(tx, payBands, dataset.payBands);
    await insertChunked(tx, employees, dataset.employees);
    await insertChunked(tx, salaryChanges, dataset.salaryChanges);
    for (const user of seedUsers) {
      await tx
        .insert(users)
        .values(user)
        .onConflictDoUpdate({
          target: users.email,
          set: {
            displayName: sql`excluded.display_name`,
            role: sql`excluded.role`,
            passwordHash: sql`excluded.password_hash`,
          },
        });
    }
  });
}

import { describe, expect, it } from 'vitest';
import { anEmployee, aReferenceSet } from '../../test/builders/index.ts';
import { testDb } from '../../test/helpers.ts';
import { SOFTWARE_ENGINEER } from '../seed/reference.ts';

const messageChain = (error: unknown): string => {
  const parts: string[] = [];
  for (let e = error; e instanceof Error; e = e.cause) parts.push(e.message);
  return parts.join(' <- ');
};

describe('database integrity', () => {
  it('rejects a row that breaks a foreign key (foreign keys are on)', async () => {
    const db = await testDb(aReferenceSet().withoutBand('IN', SOFTWARE_ENGINEER, 'L5'));

    const error = await anEmployee()
      .inCountry('IN')
      .atLevel('L5')
      .withSalary(500_000_000)
      .insert(db)
      .catch((e: unknown) => e);

    expect(messageChain(error)).toMatch(/FOREIGN KEY constraint failed/);
    expect((await db.$client.execute('SELECT count(*) AS n FROM employees')).rows[0]?.n).toBe(0);
  });

  it('keeps data written in a transaction visible to the next read on an in-memory database', async () => {
    const db = await testDb();

    await db.transaction(async (tx) => {
      await anEmployee().named('Lena', 'Vogel').insert(tx);
    });
    const rows = await db.$client.execute('SELECT first_name FROM employees');

    expect(rows.rows.map((row) => row.first_name)).toEqual(['Lena']);
  });
});

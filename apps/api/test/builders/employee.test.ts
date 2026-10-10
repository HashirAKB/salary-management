import { describe, expect, it } from 'vitest';
import { testDb } from '../helpers.ts';
import { anEmployee, merit, promotion } from './index.ts';

describe('anEmployee builder', () => {
  it('anEmployee().withHistory keeps the current-salary columns equal to the last row', async () => {
    const db = await testDb();

    const { id } = await anEmployee()
      .atLevel('L2')
      .withSalary(10_000_000)
      .hiredOn('2022-01-10')
      .withHistory([merit('2023-04-01', 4.0), promotion('2024-04-01', 'L3', 12.0)])
      .insert(db);
    const employee = (
      await db.$client.execute({
        sql: 'SELECT salary_minor, salary_effective_date, level_code FROM employees WHERE id = ?',
        args: [id],
      })
    ).rows[0];
    const history = (
      await db.$client.execute({
        sql: 'SELECT reason, effective_date, amount_minor, level_code FROM salary_changes WHERE employee_id = ? ORDER BY effective_date',
        args: [id],
      })
    ).rows.map((row) => ({ ...row }));

    expect(history).toEqual([
      { reason: 'hire', effective_date: '2022-01-10', amount_minor: 10_000_000, level_code: 'L2' },
      { reason: 'merit', effective_date: '2023-04-01', amount_minor: 10_400_000, level_code: 'L2' },
      {
        reason: 'promotion',
        effective_date: '2024-04-01',
        amount_minor: 11_648_000,
        level_code: 'L3',
      },
    ]);
    expect({ ...employee }).toEqual({
      salary_minor: 11_648_000,
      salary_effective_date: '2024-04-01',
      level_code: 'L3',
    });
  });
});

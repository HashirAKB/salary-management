import type { Db } from '../src/db/client.ts';

/**
 * Employees whose current-salary columns differ from their latest history row (D-021). Latest is by
 * effective date, then id. An empty list means the invariant holds.
 */
export async function currentSalaryMismatches(db: Db): Promise<string[]> {
  const result = await db.$client.execute(`
    SELECT e.employee_code
    FROM employees e
    JOIN salary_changes s ON s.id = (
      SELECT id FROM salary_changes WHERE employee_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1
    )
    WHERE s.amount_minor <> e.salary_minor OR s.currency_code <> e.salary_currency
       OR s.effective_date <> e.salary_effective_date OR s.job_title_id <> e.job_title_id
       OR s.level_code <> e.level_code
    ORDER BY e.employee_code`);
  return result.rows.map((row) => String(row.employee_code));
}

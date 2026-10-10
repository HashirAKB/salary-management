import { describe, expect, it } from 'vitest';
import { createDb, type Db } from './client.ts';
import { migrate } from './migrate.ts';

const tableNames = async (db: Db) =>
  (
    await db.$client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
  ).rows.map((row) => row.name);

const indexNames = async (db: Db) =>
  (
    await db.$client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'ix_%' ORDER BY name",
    )
  ).rows.map((row) => row.name);

describe('migrate', () => {
  it('runs every migration on an empty database, and running them again changes nothing', async () => {
    const db = createDb(':memory:');

    const firstRun = await migrate(db);
    const tablesAfterFirst = await tableNames(db);
    const applied = await db.$client.execute('SELECT name FROM schema_migrations ORDER BY name');
    const secondRun = await migrate(db);

    expect(firstRun).toEqual(['0001_init.sql']);
    expect(tablesAfterFirst).toEqual([
      'ask_log',
      'countries',
      'departments',
      'employees',
      'fx_rates',
      'job_titles',
      'levels',
      'pay_bands',
      'salary_changes',
      'schema_migrations',
      'sessions',
      'users',
    ]);
    expect(await indexNames(db)).toEqual([
      'ix_ask_log_time',
      'ix_ask_log_user_time',
      'ix_employees_cohort',
      'ix_employees_hire_date',
      'ix_employees_salary_date',
      'ix_employees_status_name',
      'ix_employees_title_level',
      'ix_salary_changes_employee',
      'ix_sessions_user',
    ]);
    expect(applied.rows.map((row) => row.name)).toEqual(['0001_init.sql']);
    expect(secondRun).toEqual([]);
    expect(await tableNames(db)).toEqual(tablesAfterFirst);
    expect(
      (await db.$client.execute('SELECT count(*) AS n FROM schema_migrations')).rows[0]?.n,
    ).toBe(1);
  });
});

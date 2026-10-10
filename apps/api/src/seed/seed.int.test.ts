import { describe, expect, it } from 'vitest';
import { createDb, type Db } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { generateDataset, REF_DATE, SEED, SEED_CONFIG, type Dataset } from './generate.ts';
import { generateReferenceData } from './reference.ts';
import { writeDataset, type SeedUser } from './write.ts';

// The one file that writes the full seed (05 section 4.1). Read-only checks share one write.

const users = (hashSuffix: string): SeedUser[] => [
  {
    email: 'hr.admin@acme.test',
    displayName: 'HR Admin (demo)',
    role: 'hr_admin',
    passwordHash: `admin-${hashSuffix}`,
    createdAt: '2026-09-30T00:00:00.000Z',
  },
  {
    email: 'hr.viewer@acme.test',
    displayName: 'HR Viewer (demo)',
    role: 'hr_viewer',
    passwordHash: `viewer-${hashSuffix}`,
    createdAt: '2026-09-30T00:00:00.000Z',
  },
  {
    email: 'finance@acme.test',
    displayName: 'Finance (demo)',
    role: 'finance',
    passwordHash: `finance-${hashSuffix}`,
    createdAt: '2026-09-30T00:00:00.000Z',
  },
];

let cachedDataset: Dataset | undefined;
const dataset = () => (cachedDataset ??= generateDataset(SEED_CONFIG, SEED, REF_DATE));

const emptyDb = async (): Promise<Db> => {
  const db = createDb(':memory:');
  await migrate(db);
  return db;
};

let seeded: Promise<Db> | undefined;
const seededDb = () =>
  (seeded ??= emptyDb().then(async (db) => {
    await writeDataset(db, dataset(), users('one'));
    return db;
  }));

const DOMAIN_TABLES = [
  'fx_rates',
  'countries',
  'departments',
  'job_titles',
  'levels',
  'pay_bands',
  'employees',
  'salary_changes',
];

const snapshot = async (db: Db) => {
  const tables: Record<string, string> = {};
  for (const table of DOMAIN_TABLES) {
    const rows = await db.$client.execute(`SELECT * FROM ${table} ORDER BY rowid`);
    tables[table] = JSON.stringify(rows.rows);
  }
  return tables;
};

const count = async (db: Db, table: string) =>
  Number((await db.$client.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0]?.n);

describe('writeDataset (seed.int)', () => {
  it("after writeDataset, every employee's current-salary columns equal their latest history row, and foreign keys are on", async () => {
    const db = await seededDb();

    const mismatches = await db.$client.execute(`
      SELECT e.employee_code
      FROM employees e
      JOIN salary_changes s ON s.id = (
        SELECT id FROM salary_changes WHERE employee_id = e.id ORDER BY effective_date DESC, id DESC LIMIT 1
      )
      WHERE s.amount_minor <> e.salary_minor OR s.currency_code <> e.salary_currency
         OR s.effective_date <> e.salary_effective_date OR s.job_title_id <> e.job_title_id
         OR s.level_code <> e.level_code`);
    const foreignKeys = await db.$client.execute('PRAGMA foreign_keys');
    const violations = await db.$client.execute('PRAGMA foreign_key_check');

    expect(await count(db, 'employees')).toBe(10_250);
    expect(await count(db, 'salary_changes')).toBe(dataset().salaryChanges.length);
    expect(mismatches.rows).toEqual([]);
    expect(foreignKeys.rows[0]?.foreign_keys).toBe(1);
    expect(violations.rows).toEqual([]);
  });

  it('running the seed twice leaves identical domain data and resets sessions and ask_log', async () => {
    const db = await emptyDb();
    await writeDataset(db, dataset(), users('one'));
    const before = await snapshot(db);
    await db.$client.execute(
      "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) SELECT 'abc', id, '2026-10-09T09:00:00.000Z', '2026-10-09T17:00:00.000Z' FROM users LIMIT 1",
    );
    await db.$client.execute(
      "INSERT INTO ask_log (user_id, asked_at, question, outcome) SELECT id, '2026-10-09T09:00:00.000Z', 'How many?', 'answered' FROM users LIMIT 1",
    );

    await writeDataset(db, dataset(), users('one'));

    expect(await snapshot(db)).toEqual(before);
    expect(await count(db, 'sessions')).toBe(0);
    expect(await count(db, 'ask_log')).toBe(0);
  });

  it('upserts the three demo users by email, so a second run replaces their password hash', async () => {
    const db = await emptyDb();
    const referenceOnly: Dataset = { ...generateReferenceData(), employees: [], salaryChanges: [] };
    await writeDataset(db, referenceOnly, users('one'));
    const first = await db.$client.execute('SELECT id, email FROM users ORDER BY id');

    await writeDataset(db, referenceOnly, users('two'));
    const second = await db.$client.execute(
      'SELECT id, email, role, password_hash FROM users ORDER BY id',
    );

    expect(second.rows.map((r) => ({ id: r.id, email: r.email }))).toEqual(
      first.rows.map((r) => ({ id: r.id, email: r.email })),
    );
    expect(second.rows.map((r) => [r.email, r.role, r.password_hash])).toEqual([
      ['hr.admin@acme.test', 'hr_admin', 'admin-two'],
      ['hr.viewer@acme.test', 'hr_viewer', 'viewer-two'],
      ['finance@acme.test', 'finance', 'finance-two'],
    ]);
  });
});

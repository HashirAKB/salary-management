import { loadConfig } from '../config.ts';
import { createDb, type Db } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import type { Role } from '../db/schema.ts';
import { hashPassword, PRODUCTION_SCRYPT, type ScryptParams } from '../modules/auth/password.ts';
import { generateDataset, REF_DATE, SEED, SEED_CONFIG } from './generate.ts';
import { formatSeedReport, seedReport } from './report.ts';
import { writeDataset, type SeedUser } from './write.ts';

export type SeedDeps = {
  openDb: (url: string, authToken?: string) => Db;
  log: (line: string) => void;
  error: (line: string) => void;
  /** Defaults to the production cost. */
  scrypt?: ScryptParams;
};

// 02 section 7.9: the three demo accounts and the variables holding their passwords.
const DEMO_USERS: { email: string; displayName: string; role: Role; variable: string }[] = [
  {
    email: 'hr.admin@acme.test',
    displayName: 'HR Admin (demo)',
    role: 'hr_admin',
    variable: 'DEMO_HR_ADMIN_PASSWORD',
  },
  {
    email: 'hr.viewer@acme.test',
    displayName: 'HR Viewer (demo)',
    role: 'hr_viewer',
    variable: 'DEMO_HR_VIEWER_PASSWORD',
  },
  {
    email: 'finance@acme.test',
    displayName: 'Finance (demo)',
    role: 'finance',
    variable: 'DEMO_FINANCE_PASSWORD',
  },
];

const MIN_PASSWORD_LENGTH = 12;

// npm run seed (02 section 7.1): validates the demo passwords before touching the database, then
// migrates, writes the dataset and users in one transaction, and prints the report.
export async function runSeed(
  env: Record<string, string | undefined>,
  deps: SeedDeps,
): Promise<number> {
  const invalid = DEMO_USERS.filter((u) => (env[u.variable] ?? '').length < MIN_PASSWORD_LENGTH);
  if (invalid.length > 0) {
    deps.error('Cannot seed: demo passwords are missing or too short.');
    for (const u of invalid) {
      deps.error(`  ${u.variable}: must be set and at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    return 1;
  }
  const config = loadConfig(env);

  const db = deps.openDb(config.databaseUrl, config.databaseAuthToken);
  await migrate(db);
  const dataset = generateDataset(SEED_CONFIG, SEED, REF_DATE);
  const users: SeedUser[] = await Promise.all(
    DEMO_USERS.map(async (u) => ({
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      passwordHash: await hashPassword(env[u.variable] ?? '', deps.scrypt ?? PRODUCTION_SCRYPT),
      createdAt: `${REF_DATE}T00:00:00.000Z`,
    })),
  );
  await writeDataset(db, dataset, users);
  deps.log(formatSeedReport(seedReport(dataset, SEED_CONFIG)));
  return 0;
}

if (import.meta.main) {
  process.exitCode = await runSeed(process.env, {
    openDb: createDb,
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  });
}

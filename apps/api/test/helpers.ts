import { buildApp, type AppDeps } from '../src/app.ts';
import type { Config } from '../src/config.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';
import { fixedClock } from '../src/domain/clock.ts';
import { aReferenceSet } from './builders/index.ts';

export const testConfig: Config = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: ':memory:',
  databaseAuthToken: undefined,
  askProvider: 'anthropic',
  geminiApiKey: undefined,
  anthropicApiKey: undefined,
  askModel: 'claude-haiku-5-5',
  askUserDailyLimit: 30,
  askGlobalDailyLimit: 300,
  logLevel: 'silent',
  // Tests hash at N=2^10 to stay fast (03 section 7).
  scrypt: { N: 1024, r: 8, p: 3 },
};

// A fresh in-memory database with the real migrations and the seed's reference data (05 section 4.1).
export async function testDb(reference = aReferenceSet()): Promise<Db> {
  const db = createDb(':memory:');
  await migrate(db);
  await reference.insert(db);
  return db;
}

// A fresh app on its own in-memory database for every test (05 section 4.1). The database is
// migrated and given reference data before the app is ready. A test that passes its own db
// prepares it itself.
export function testApp(overrides: Partial<AppDeps> = {}) {
  const db = overrides.db ?? createDb(':memory:');
  const app = buildApp({
    db,
    clock: fixedClock('2026-10-09T09:00:00.000Z'),
    config: testConfig,
    ...overrides,
  });
  if (!overrides.db) {
    app.addHook('onReady', async () => {
      await migrate(db);
      await aReferenceSet().insert(db);
    });
  }
  return app;
}

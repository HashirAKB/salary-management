import { buildApp, type AppDeps } from '../src/app.ts';
import type { Config } from '../src/config.ts';
import { createDb } from '../src/db/client.ts';
import { fixedClock } from '../src/domain/clock.ts';

export const testConfig: Config = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: ':memory:',
  databaseAuthToken: undefined,
  anthropicApiKey: undefined,
  askModel: 'claude-haiku-5-5',
  askUserDailyLimit: 30,
  askGlobalDailyLimit: 300,
  logLevel: 'silent',
};

// A fresh app on its own in-memory database for every test (05 section 4.1).
export function testApp(overrides: Partial<AppDeps> = {}) {
  return buildApp({
    db: createDb(':memory:'),
    clock: fixedClock('2026-10-09T09:00:00.000Z'),
    config: testConfig,
    ...overrides,
  });
}

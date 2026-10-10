import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.ts';
import { PRODUCTION_SCRYPT } from './modules/auth/password.ts';

function invalidVariables(env: Record<string, string | undefined>): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems.map((p) => p.variable);
    throw error;
  }
  throw new Error('expected loadConfig to throw a ConfigError');
}

describe('config', () => {
  it('rejects a missing DATABASE_URL and lists every invalid variable', () => {
    const variables = invalidVariables({ PORT: 'abc', LOG_LEVEL: 'loud' });

    expect(variables).toHaveLength(3);
    expect(variables).toEqual(expect.arrayContaining(['DATABASE_URL', 'PORT', 'LOG_LEVEL']));
  });

  it('applies the documented defaults, including the production scrypt cost, when optional variables are absent or empty', () => {
    const config = loadConfig({
      DATABASE_URL: 'file:./data/dev.db',
      ANTHROPIC_API_KEY: '',
      LOG_LEVEL: '',
    });

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3000,
      databaseUrl: 'file:./data/dev.db',
      databaseAuthToken: undefined,
      anthropicApiKey: undefined,
      askModel: 'claude-haiku-5-5',
      askUserDailyLimit: 30,
      askGlobalDailyLimit: 300,
      logLevel: 'info',
      scrypt: PRODUCTION_SCRYPT,
    });
  });

  it('requires DATABASE_AUTH_TOKEN when NODE_ENV is production', () => {
    const variables = invalidVariables({
      NODE_ENV: 'production',
      DATABASE_URL: 'libsql://acme.turso.io',
    });

    expect(variables).toEqual(['DATABASE_AUTH_TOKEN']);
  });
});

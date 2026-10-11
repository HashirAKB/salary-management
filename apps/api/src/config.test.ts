import { describe, expect, it } from 'vitest';
import { askApiKey, ConfigError, loadConfig } from './config.ts';
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
      askProvider: 'gemini',
      geminiApiKey: undefined,
      anthropicApiKey: undefined,
      askModel: 'gemini-2.5-flash',
      askUserDailyLimit: 30,
      askGlobalDailyLimit: 300,
      logLevel: 'info',
      scrypt: PRODUCTION_SCRYPT,
    });
  });

  it('picks the Ask provider, its default model and its key (ADR 0009)', () => {
    const base = { DATABASE_URL: ':memory:', GEMINI_API_KEY: 'g-key', ANTHROPIC_API_KEY: 'a-key' };

    const gemini = loadConfig(base);
    expect(askApiKey(gemini)).toBe('g-key');
    expect(gemini.askModel).toBe('gemini-2.5-flash');

    const anthropic = loadConfig({ ...base, ASK_PROVIDER: 'anthropic' });
    expect(askApiKey(anthropic)).toBe('a-key');
    expect(anthropic.askModel).toBe('claude-haiku-5-5');

    expect(loadConfig({ ...base, ASK_MODEL: 'custom-model' }).askModel).toBe('custom-model');
    expect(askApiKey(loadConfig({ DATABASE_URL: ':memory:' }))).toBeUndefined();
    expect(invalidVariables({ DATABASE_URL: ':memory:', ASK_PROVIDER: 'openai' })).toEqual([
      'ASK_PROVIDER',
    ]);
  });

  it('requires DATABASE_AUTH_TOKEN when NODE_ENV is production', () => {
    const variables = invalidVariables({
      NODE_ENV: 'production',
      DATABASE_URL: 'libsql://acme.turso.io',
    });

    expect(variables).toEqual(['DATABASE_AUTH_TOKEN']);
  });
});

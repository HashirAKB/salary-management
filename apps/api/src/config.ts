import { z } from 'zod';
import { PRODUCTION_SCRYPT, type ScryptParams } from './modules/auth/password.ts';

export type Config = {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  anthropicApiKey: string | undefined;
  askModel: string;
  askUserDailyLimit: number;
  askGlobalDailyLimit: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  /** Password hashing cost (03 section 7); not an env variable. */
  scrypt: ScryptParams;
};

export type ConfigProblem = { variable: string; message: string };

export class ConfigError extends Error {
  readonly problems: ConfigProblem[];

  constructor(problems: ConfigProblem[]) {
    super(
      `Invalid environment:\n${problems.map((p) => `  ${p.variable}: ${p.message}`).join('\n')}`,
    );
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

// An empty value (as copied from .env.example) counts as not set.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const positiveInt = z.coerce.number().int().positive();

// 03-architecture section 8.
const envSchema = z
  .object({
    NODE_ENV: optional(z.enum(['development', 'production', 'test']).default('development')),
    PORT: optional(positiveInt.default(3000)),
    DATABASE_URL: optional(z.string({ error: 'Required.' })),
    DATABASE_AUTH_TOKEN: optional(z.string().optional()),
    ANTHROPIC_API_KEY: optional(z.string().optional()),
    ASK_MODEL: optional(z.string().default('claude-haiku-5-5')),
    ASK_USER_DAILY_LIMIT: optional(positiveInt.default(30)),
    ASK_GLOBAL_DAILY_LIMIT: optional(positiveInt.default(300)),
    LOG_LEVEL: optional(
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.DATABASE_AUTH_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_AUTH_TOKEN'],
        message: 'Required when NODE_ENV is production.',
      });
    }
  });

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => ({
        variable: String(issue.path[0]),
        message: issue.message,
      })),
    );
  }
  const e = result.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    databaseAuthToken: e.DATABASE_AUTH_TOKEN,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    askModel: e.ASK_MODEL,
    askUserDailyLimit: e.ASK_USER_DAILY_LIMIT,
    askGlobalDailyLimit: e.ASK_GLOBAL_DAILY_LIMIT,
    logLevel: e.LOG_LEVEL,
    scrypt: PRODUCTION_SCRYPT,
  };
}

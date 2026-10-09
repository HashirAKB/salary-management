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
};

export type ConfigProblem = { variable: string; message: string };

export class ConfigError extends Error {
  readonly problems: ConfigProblem[];

  constructor(problems: ConfigProblem[]) {
    super('not implemented');
    this.problems = problems;
    throw new Error('not implemented');
  }
}

export function loadConfig(_env: Record<string, string | undefined>): Config {
  throw new Error('not implemented');
}

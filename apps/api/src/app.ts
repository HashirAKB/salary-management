import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { Clock } from './domain/clock.ts';
import { registerErrorHandling } from './http/error-handler.ts';

export type AppDeps = {
  db: Db;
  clock: Clock;
  config: Config;
};

// The composition root used by main.ts and every test (03 section 6, rule 1).
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: { level: deps.config.logLevel }, trustProxy: true });
  registerErrorHandling(app);
  return app;
}

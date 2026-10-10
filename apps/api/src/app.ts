import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { Clock } from './domain/clock.ts';
import { registerErrorHandling } from './http/error-handler.ts';
import { registerStatic } from './http/static.ts';
import { registerAuth } from './modules/auth/plugin.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { healthRoutes } from './modules/health/routes.ts';

export type AppDeps = {
  db: Db;
  clock: Clock;
  config: Config;
  /** Folder with the web build; static serving with an SPA fallback is on when set. */
  staticRoot?: string;
};

// The composition root used by main.ts and every test (03 section 6, rule 1).
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: { level: deps.config.logLevel }, trustProxy: true });
  if (deps.staticRoot) registerStatic(app, deps.staticRoot);
  registerErrorHandling(app, { spaFallback: Boolean(deps.staticRoot) });
  registerAuth(app, { db: deps.db });
  healthRoutes(app, { db: deps.db });
  authRoutes(app, deps);
  return app;
}

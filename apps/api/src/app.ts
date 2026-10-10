import Fastify, { type FastifyInstance } from 'fastify';
import { validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { Clock } from './domain/clock.ts';
import { registerErrorHandling } from './http/error-handler.ts';
import { loggerOptions } from './http/logger.ts';
import { registerRouteCatalog } from './http/route-catalog.ts';
import { registerStatic } from './http/static.ts';
import { registerAuth } from './modules/auth/plugin.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { employeeRoutes } from './modules/employees/routes.ts';
import { healthRoutes } from './modules/health/routes.ts';
import { referenceRoutes } from './modules/reference/routes.ts';

export type AppDeps = {
  db: Db;
  clock: Clock;
  config: Config;
  /** Folder with the web build; static serving with an SPA fallback is on when set. */
  staticRoot?: string;
  /** Where log lines go; stdout when absent. Tests capture it (05 section 5.0). */
  logStream?: { write(line: string): void };
};

// The composition root used by main.ts and every test (03 section 6, rule 1).
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: loggerOptions(deps.config, deps.logStream),
    // Trust only the immediate peer, Render's proxy (the service has no other way in), so
    // request.ip is the address it appends and a client can't spoof X-Forwarded-For to get round
    // the login rate limit. 04 section 4.1 says `true`; changed after the S2 review.
    trustProxy: (_address, hop) => hop === 0,
  });
  // Step 5 of the request pipeline (04 section 4.3): zod validation of params, query and body.
  app.setValidatorCompiler(validatorCompiler);
  registerRouteCatalog(app);
  if (deps.staticRoot) registerStatic(app, deps.staticRoot);
  registerErrorHandling(app, { spaFallback: Boolean(deps.staticRoot) });
  registerAuth(app, deps);
  healthRoutes(app, { db: deps.db });
  authRoutes(app, deps);
  referenceRoutes(app, { db: deps.db });
  employeeRoutes(app, { db: deps.db });
  return app;
}

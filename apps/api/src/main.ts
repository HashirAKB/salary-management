import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { ConfigError, loadConfig, type Config } from './config.ts';
import { createDb } from './db/client.ts';
import { systemClock } from './domain/clock.ts';

function readConfig(): Config {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const config = readConfig();
const db = createDb(config.databaseUrl, config.databaseAuthToken);
// apps/api/{src,dist}/main → apps/web/dist; served only in production (03 section 8).
const staticRoot =
  config.nodeEnv === 'production'
    ? fileURLToPath(new URL('../../web/dist', import.meta.url))
    : undefined;

const app = buildApp({ db, clock: systemClock, config, staticRoot });
await app.listen({ host: '0.0.0.0', port: config.port });

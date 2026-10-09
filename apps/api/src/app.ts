import type { FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import type { Db } from './db/client.ts';
import type { Clock } from './domain/clock.ts';

export type AppDeps = {
  db: Db;
  clock: Clock;
  config: Config;
};

export function buildApp(_deps: AppDeps): FastifyInstance {
  throw new Error('not implemented');
}

import type { HealthResponse } from '@acme/shared';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import { requires } from '../../http/guard.ts';
import { AppError } from '../../http/problem.ts';

// A1 (04 section 5.1): public, answers when the database runs SELECT 1.
export function healthRoutes(app: FastifyInstance, { db }: { db: Db }) {
  app.get(
    '/api/health',
    { onRequest: requires('public') },
    async (request): Promise<HealthResponse> => {
      try {
        await db.run(sql`SELECT 1`);
      } catch (err) {
        request.log.error({ err }, 'health check could not reach the database');
        throw new AppError(503, 'DB_UNAVAILABLE', 'The database is not answering right now.');
      }
      return { status: 'ok' };
    },
  );
}

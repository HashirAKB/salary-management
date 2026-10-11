import { insightsSummaryQuerySchema, type InsightsSummaryResponse } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { requires } from '../../http/guard.ts';
import { getSummary } from './service.ts';

export function insightsRoutes(app: FastifyInstance, deps: { db: Db; clock: Clock }) {
  // I1 (04 section 5.6).
  app.get(
    '/api/insights/summary',
    { onRequest: requires('insights.read'), schema: { querystring: insightsSummaryQuerySchema } },
    async (request): Promise<InsightsSummaryResponse> =>
      getSummary(deps.db, request.viewer!, deps.clock.today()),
  );
}

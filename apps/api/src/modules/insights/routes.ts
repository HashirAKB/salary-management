import {
  insightsSummaryQuerySchema,
  payDistributionQuerySchema,
  payEquityQuerySchema,
  type InsightsSummaryResponse,
  type PayDistributionQuery,
  type PayDistributionResponse,
  type PayEquityQuery,
  type PayEquityResponse,
} from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { requires } from '../../http/guard.ts';
import { getPayDistribution, getPayEquity, getSummary } from './service.ts';

export function insightsRoutes(app: FastifyInstance, deps: { db: Db; clock: Clock }) {
  // I1 (04 section 5.6).
  app.get(
    '/api/insights/summary',
    { onRequest: requires('insights.read'), schema: { querystring: insightsSummaryQuerySchema } },
    async (request): Promise<InsightsSummaryResponse> =>
      getSummary(deps.db, request.viewer!, deps.clock.today()),
  );

  // I2 (04 section 5.6).
  app.get(
    '/api/insights/pay-distribution',
    { onRequest: requires('insights.read'), schema: { querystring: payDistributionQuerySchema } },
    async (request): Promise<PayDistributionResponse> =>
      getPayDistribution(deps.db, request.viewer!, request.query as PayDistributionQuery),
  );

  // I3 (04 section 5.6).
  app.get(
    '/api/insights/pay-equity',
    { onRequest: requires('insights.read'), schema: { querystring: payEquityQuerySchema } },
    async (request): Promise<PayEquityResponse> =>
      getPayEquity(deps.db, request.query as PayEquityQuery),
  );
}

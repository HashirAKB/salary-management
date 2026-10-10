import type { ReferenceResponse } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import { requires } from '../../http/guard.ts';

// R1 (04 section 5.3). Stub until the green commit.
export function referenceRoutes(app: FastifyInstance, _deps: { db: Db }) {
  app.get(
    '/api/reference',
    { onRequest: requires('reference.read') },
    async (): Promise<ReferenceResponse> => {
      throw new Error('not implemented');
    },
  );
}

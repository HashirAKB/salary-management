import type { Role } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import { readSid } from './cookie.ts';
import { hashToken } from './service.ts';
import { findSessionUser } from './sessions.ts';

export type Viewer = { id: number; email: string; displayName: string; role: Role };

declare module 'fastify' {
  interface FastifyRequest {
    viewer: Viewer | null;
  }
}

// Step 1 of the request pipeline (04 section 4.3): resolve the `sid` cookie to the viewer.
export function registerAuth(app: FastifyInstance, { db }: { db: Db }) {
  app.decorateRequest('viewer', null);
  app.addHook('onRequest', async (request) => {
    const token = readSid(request.headers.cookie);
    const user = token ? await findSessionUser(db, hashToken(token)) : undefined;
    request.viewer = user
      ? { id: user.id, email: user.email, displayName: user.displayName, role: user.role }
      : null;
  });
}

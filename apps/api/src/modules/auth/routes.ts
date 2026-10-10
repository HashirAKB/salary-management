import { loginBodySchema, type MeResponse } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { sessionCookie } from './cookie.ts';
import { login, type AuthDeps } from './service.ts';

// A2 to A4 (04 section 5.2).
export function authRoutes(app: FastifyInstance, deps: AuthDeps) {
  app.post('/api/auth/login', async (request, reply): Promise<MeResponse> => {
    const body = loginBodySchema.parse(request.body);
    const { token, me } = await login(deps, body.email, body.password);
    reply.header(
      'set-cookie',
      sessionCookie(token, { secure: deps.config.nodeEnv === 'production' }),
    );
    return me;
  });
}

import { loginBodySchema, type LoginBody, type MeResponse } from '@acme/shared';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { requires } from '../../http/guard.ts';
import { AppError } from '../../http/problem.ts';
import { clearedSessionCookie, readSid, sessionCookie } from './cookie.ts';
import { hashToken, login, meFor, type AuthDeps } from './service.ts';
import { deleteSession } from './sessions.ts';

// 10 attempts per minute per client IP; request.ip honours X-Forwarded-For (trustProxy, 04 4.1).
const LOGIN_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

// A2 to A4 (04 section 5.2).
export function authRoutes(app: FastifyInstance, deps: AuthDeps) {
  const secure = deps.config.nodeEnv === 'production';

  app.register(async (scope) => {
    await scope.register(rateLimit, {
      global: false,
      errorResponseBuilder: (_request, context) =>
        new AppError(
          429,
          'RATE_LIMITED',
          `Too many login attempts. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        ),
    });

    scope.post(
      '/api/auth/login',
      {
        onRequest: requires('public'),
        schema: { body: loginBodySchema },
        config: { rateLimit: LOGIN_RATE_LIMIT },
      },
      async (request, reply): Promise<MeResponse> => {
        const body = request.body as LoginBody;
        const { token, me } = await login(deps, body.email, body.password);
        reply.header('set-cookie', sessionCookie(token, { secure }));
        return me;
      },
    );
  });

  // Always 204, with or without a session (A3).
  app.post('/api/auth/logout', { onRequest: requires('public') }, async (request, reply) => {
    const token = readSid(request.headers.cookie);
    if (token) await deleteSession(deps.db, hashToken(token));
    reply.header('set-cookie', clearedSessionCookie({ secure }));
    return reply.status(204).send();
  });

  app.get(
    '/api/auth/me',
    { onRequest: requires('authenticated') },
    async (request): Promise<MeResponse> => meFor(deps, request.viewer!),
  );
}

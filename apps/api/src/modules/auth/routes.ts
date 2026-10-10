import { loginBodySchema, type MeResponse } from '@acme/shared';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../http/problem.ts';
import { sessionCookie } from './cookie.ts';
import { login, meFor, type AuthDeps } from './service.ts';

// 10 attempts per minute per client IP; request.ip honours X-Forwarded-For (trustProxy, 04 4.1).
const LOGIN_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

// A2 to A4 (04 section 5.2).
export function authRoutes(app: FastifyInstance, deps: AuthDeps) {
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
      { config: { rateLimit: LOGIN_RATE_LIMIT } },
      async (request, reply): Promise<MeResponse> => {
        const body = loginBodySchema.parse(request.body);
        const { token, me } = await login(deps, body.email, body.password);
        reply.header(
          'set-cookie',
          sessionCookie(token, { secure: deps.config.nodeEnv === 'production' }),
        );
        return me;
      },
    );
  });

  app.get('/api/auth/me', async (request): Promise<MeResponse> => {
    if (!request.viewer) throw new AppError(401, 'UNAUTHENTICATED', 'Log in to continue.');
    return meFor(deps, request.viewer);
  });
}

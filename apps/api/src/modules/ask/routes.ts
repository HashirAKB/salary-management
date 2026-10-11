import { askBodySchema, type AskResponse } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { askApiKey, type Config } from '../../config.ts';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { requires } from '../../http/guard.ts';
import { AppError } from '../../http/problem.ts';
import type { QueryInterpreter } from './interpreter.ts';
import { createInterpreter } from './provider.ts';
import { loadAskReference } from './repo.ts';
import { askQuestion } from './service.ts';

export function askRoutes(
  app: FastifyInstance,
  deps: { db: Db; clock: Clock; config: Config; interpreter?: QueryInterpreter },
) {
  // The injected interpreter wins (tests); otherwise the configured provider (ADR 0009), built once on first use because
  // its tool schemas come from the reference data.
  let built: Promise<QueryInterpreter> | undefined;
  const getInterpreter = (): Promise<QueryInterpreter> => {
    if (deps.interpreter) return Promise.resolve(deps.interpreter);
    built ??= loadAskReference(deps.db).then((reference) =>
      createInterpreter(deps.config, reference),
    );
    return built;
  };

  // K1 (04 section 5.8).
  app.post(
    '/api/ask',
    { onRequest: requires('ask.use'), schema: { body: askBodySchema } },
    async (request): Promise<AskResponse> => {
      if (!askApiKey(deps.config)) {
        throw new AppError(503, 'ASK_UNAVAILABLE', "Ask about pay isn't set up on this server.");
      }
      const { question } = request.body as { question: string };
      return askQuestion({ ...deps, getInterpreter }, request.viewer!, question);
    },
  );
}

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError, problem, type ProblemInput } from './problem.ts';

const pathOf = (request: FastifyRequest): string => request.url.split('?', 1)[0] ?? request.url;

function sendProblem(reply: FastifyReply, input: ProblemInput) {
  return reply.status(input.status).type('application/problem+json').send(problem(input));
}

// Every non-2xx response is application/problem+json (03 section 6, rule 6).
export function registerErrorHandling(
  app: FastifyInstance,
  { spaFallback }: { spaFallback: boolean },
) {
  // Writes accept JSON only (04 section 4.1); without this parser other types are 415.
  app.removeContentTypeParser('text/plain');

  // Unknown /api paths are always a problem, never the web app (04 section 8.1).
  app.setNotFoundHandler((request, reply) => {
    const path = pathOf(request);
    if (spaFallback && path !== '/api' && !path.startsWith('/api/')) {
      return reply.type('text/html').sendFile('index.html');
    }
    return sendProblem(reply, {
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      detail: `No API route matches ${request.method} ${path}.`,
      instance: path,
    });
  });

  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      if (error.headers) reply.headers(error.headers);
      return sendProblem(reply, {
        status: error.status,
        code: error.code,
        detail: error.message,
        instance: pathOf(request),
        ...(error.errors && { errors: error.errors }),
      });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors = error.validation.map((issue) => ({
        path: issue.instancePath.slice(1).replaceAll('/', '.'),
        message: issue.message ?? 'Invalid value.',
      }));
      return sendProblem(reply, {
        status: 400,
        code: 'VALIDATION_FAILED',
        detail:
          errors.length === 1 ? '1 field is invalid.' : `${errors.length} fields are invalid.`,
        instance: pathOf(request),
        errors,
      });
    }
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return sendProblem(reply, {
        status: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        detail: 'Send the request body as application/json.',
        instance: pathOf(request),
      });
    }
    request.log.error({ err: error }, 'unexpected error');
    return sendProblem(reply, {
      status: 500,
      code: 'INTERNAL',
      detail: 'Something went wrong on our side. Try again in a moment.',
      instance: pathOf(request),
    });
  });
}

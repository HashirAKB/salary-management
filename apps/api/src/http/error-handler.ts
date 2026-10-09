import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { problem, type ProblemInput } from './problem.ts';

const pathOf = (request: FastifyRequest) => request.url.split('?')[0];

function sendProblem(reply: FastifyReply, input: ProblemInput) {
  return reply.status(input.status).type('application/problem+json').send(problem(input));
}

// Every non-2xx response is application/problem+json (03 section 6, rule 6).
export function registerErrorHandling(app: FastifyInstance) {
  // Writes accept JSON only (04 section 4.1); without this parser other types are 415.
  app.removeContentTypeParser('text/plain');

  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, {
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      detail: `No API route matches ${request.method} ${pathOf(request)}.`,
      instance: pathOf(request),
    }),
  );

  app.setErrorHandler((error: FastifyError, request, reply) => {
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

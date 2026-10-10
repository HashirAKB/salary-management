import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

// Serves the Vite build (04 section 8.1). The not-found handler sends index.html for
// non-API paths, so client routes such as /employees/42 load the app.
export function registerStatic(app: FastifyInstance, root: string) {
  app.register(fastifyStatic, { root, wildcard: false });
}

import type { FastifyInstance } from 'fastify';
import type { RouteAccess } from './guard.ts';

export type CatalogEntry = {
  method: string;
  url: string;
  /** The route's `requires(...)`, or undefined when it declares none. */
  access: RouteAccess | undefined;
};

const catalogs = new WeakMap<FastifyInstance, CatalogEntry[]>();

const accessOf = (hooks: unknown): RouteAccess | undefined =>
  [hooks]
    .flat()
    .map((hook) => (hook as { access?: RouteAccess } | undefined)?.access)
    .find(Boolean);

/** Records every /api route and its access as it is added; call before any route (D-054). */
export function registerRouteCatalog(app: FastifyInstance) {
  const entries: CatalogEntry[] = [];
  catalogs.set(app, entries);
  app.addHook('onRoute', (route) => {
    if (!route.url.startsWith('/api/')) return;
    for (const method of [route.method].flat()) {
      if (method === 'HEAD') continue;
      entries.push({ method, url: route.url, access: accessOf(route.onRequest) });
    }
  });
}

/** Every route buildApp registered, with its access (D-054). HEAD twins of GET are left out. */
export function routeCatalog(app: FastifyInstance): CatalogEntry[] {
  return [...(catalogs.get(app) ?? [])];
}

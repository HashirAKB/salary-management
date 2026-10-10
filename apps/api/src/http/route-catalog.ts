import type { FastifyInstance } from 'fastify';
import type { RouteAccess } from './guard.ts';

export type CatalogEntry = {
  method: string;
  url: string;
  /** The route's `requires(...)`, or undefined when it declares none. */
  access: RouteAccess | undefined;
};

/** Every route buildApp registered, with its access (D-054). HEAD twins of GET are left out. */
export function routeCatalog(_app: FastifyInstance): CatalogEntry[] {
  throw new Error('not implemented');
}

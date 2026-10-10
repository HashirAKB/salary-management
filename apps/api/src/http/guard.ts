import type { Action } from '@acme/shared';
import type { onRequestHookHandler } from 'fastify';

/** What a route needs: an action from 04 section 4.5, any session, or nothing. */
export type RouteAccess = Action | 'authenticated' | 'public';

/** Step 2 of the request pipeline (04 section 4.3), declared per route as `onRequest`. */
export function requires(_access: RouteAccess): onRequestHookHandler {
  throw new Error('not implemented');
}

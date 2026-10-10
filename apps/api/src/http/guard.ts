import type { Action } from '@acme/shared';
import type { onRequestHookHandler } from 'fastify';
import { can } from '../domain/permissions.ts';
import { AppError } from './problem.ts';

/** What a route needs: an action from 04 section 4.5, any session, or nothing. */
export type RouteAccess = Action | 'authenticated' | 'public';

/**
 * Step 2 of the request pipeline (04 section 4.3), declared per route as `onRequest`, so a role
 * without the action gets 403 before its body is validated (D-043).
 */
export function requires(access: RouteAccess): onRequestHookHandler & { access: RouteAccess } {
  const hook: onRequestHookHandler = async (request) => {
    if (access === 'public') return;
    if (!request.viewer) throw new AppError(401, 'UNAUTHENTICATED', 'Log in to continue.');
    if (access !== 'authenticated' && !can(request.viewer.role, access)) {
      throw new AppError(403, 'FORBIDDEN', "You don't have access to this.");
    }
  };
  // The route catalog reads this back (D-054).
  return Object.assign(hook, { access });
}

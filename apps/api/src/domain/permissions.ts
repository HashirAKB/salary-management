import type { Action, Role } from '@acme/shared';

/** The actions a role may perform, in 04 section 4.5 order. */
export function permissionsFor(_role: Role): Action[] {
  throw new Error('not implemented');
}

export function can(_role: Role, _action: Action): boolean {
  throw new Error('not implemented');
}

/** The smallest group the pay engine reports for this role (04 section 6). */
export function aggregateMinGroupSize(_role: Role): number {
  throw new Error('not implemented');
}

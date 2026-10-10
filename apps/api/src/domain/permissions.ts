import { actionSchema, type Action, type Role } from '@acme/shared';

// 04 section 4.5, exactly. /api/auth/me returns the viewer's row as `permissions`.
const ALLOWED: Record<Role, ReadonlySet<Action>> = {
  hr_admin: new Set(actionSchema.options),
  hr_viewer: new Set<Action>([
    'reference.read',
    'employee.read',
    'salary.read',
    'export.employees',
    'insights.read',
    'ask.use',
  ]),
  finance: new Set<Action>(['reference.read', 'insights.read', 'ask.use']),
};

/** The actions a role may perform, in 04 section 4.5 order. */
export function permissionsFor(role: Role): Action[] {
  return actionSchema.options.filter((action) => ALLOWED[role].has(action));
}

export function can(role: Role, action: Action): boolean {
  return ALLOWED[role].has(action);
}

/** The smallest group the pay engine reports for this role (04 section 6). */
export function aggregateMinGroupSize(role: Role): number {
  return role === 'finance' ? 5 : 1;
}

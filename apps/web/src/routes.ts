import type { Action, MeResponse } from '@acme/shared';
import { matchPath } from 'react-router';

// The screens inside the shell and the action each needs (04 section 8.1).
export const ROUTES: { path: string; action: Action; title: string }[] = [
  { path: '/employees', action: 'employee.read', title: 'Employees' },
  { path: '/employees/new', action: 'employee.write', title: 'Add employee' },
  { path: '/employees/:id', action: 'employee.read', title: 'Employee' },
  { path: '/insights', action: 'insights.read', title: 'Insights' },
  { path: '/insights/pay-equity', action: 'insights.read', title: 'Pay equity' },
  { path: '/ask', action: 'ask.use', title: 'Ask about pay' },
];

/** Whether `?next=` may send this viewer to `path`: a known in-app route they may open. */
export function mayOpen(me: MeResponse, path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  const pathname = path.split(/[?#]/, 1)[0] ?? path;
  const route = ROUTES.find((candidate) => matchPath(candidate.path, pathname));
  return route !== undefined && me.permissions.includes(route.action);
}

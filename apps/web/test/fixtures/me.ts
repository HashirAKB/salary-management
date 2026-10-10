import { meResponseSchema, type Action, type MeResponse, type Role } from '@acme/shared';

// Test data only: the web app itself reads permissions from `me` (D-046).
const PERMISSIONS: Record<Role, Action[]> = {
  hr_admin: [
    'reference.read',
    'employee.read',
    'employee.write',
    'salary.read',
    'salary.write',
    'export.employees',
    'insights.read',
    'ask.use',
  ],
  hr_viewer: [
    'reference.read',
    'employee.read',
    'salary.read',
    'export.employees',
    'insights.read',
    'ask.use',
  ],
  finance: ['reference.read', 'insights.read', 'ask.use'],
};

const NAMES: Record<Role, string> = {
  hr_admin: 'HR Admin (demo)',
  hr_viewer: 'HR Viewer (demo)',
  finance: 'Finance (demo)',
};

// Fixture builders parse with the shared response schema (D-050).
export const aMeResponse = (role: Role, overrides: Partial<MeResponse> = {}): MeResponse =>
  meResponseSchema.parse({
    user: { id: 1, email: `${role}@acme.test`, displayName: NAMES[role], role },
    permissions: PERMISSIONS[role],
    askEnabled: false,
    today: '2026-10-09',
    fxAsOf: '2026-09-30',
    ...overrides,
  });

import { actionSchema, type Action, type Role } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { aggregateMinGroupSize, can, permissionsFor } from './permissions.ts';

// 04 section 4.5, copied row by row: action, HR Admin, HR Viewer, Finance.
const TABLE: [Action, boolean, boolean, boolean][] = [
  ['reference.read', true, true, true],
  ['employee.read', true, true, false],
  ['employee.write', true, false, false],
  ['salary.read', true, true, false],
  ['salary.write', true, false, false],
  ['export.employees', true, true, false],
  ['insights.read', true, true, true],
  ['ask.use', true, true, true],
];

const ROLES: Role[] = ['hr_admin', 'hr_viewer', 'finance'];

const cases = TABLE.flatMap(([action, ...allowed]) =>
  ROLES.map((role, i) => ({ action, role, allowed: allowed[i] })),
);

describe('permissions (04 section 4.5)', () => {
  it('covers every action in the shared Action enum', () => {
    expect(TABLE.map(([action]) => action)).toEqual(actionSchema.options);
  });

  it.each(cases)(
    'the permissions table matches 04 section 4.5: $role may $action is $allowed',
    ({ role, action, allowed }) => {
      expect(can(role, action)).toBe(allowed);
      expect(permissionsFor(role).includes(action)).toBe(allowed);
    },
  );

  it("lists a role's actions in table order", () => {
    expect(permissionsFor('finance')).toEqual(['reference.read', 'insights.read', 'ask.use']);
  });

  it('aggregateMinGroupSize is 5 for Finance and 1 for the HR roles', () => {
    expect(aggregateMinGroupSize('finance')).toBe(5);
    expect(aggregateMinGroupSize('hr_admin')).toBe(1);
    expect(aggregateMinGroupSize('hr_viewer')).toBe(1);
  });
});

import {
  employeeListItemSchema,
  employeeListResponseSchema,
  type EmployeeListItem,
  type EmployeeListResponse,
} from '@acme/shared';

// Fixture builders parse with the shared response schema (D-050).
export const anEmployeeListItem = (overrides: Partial<EmployeeListItem> = {}): EmployeeListItem =>
  employeeListItemSchema.parse({
    id: 4217,
    employeeCode: 'E004217',
    firstName: 'Priya',
    lastName: 'Nair',
    gender: 'female',
    country: { code: 'IN', name: 'India' },
    department: { id: 1, name: 'Engineering' },
    jobTitle: { id: 1, name: 'Software Engineer' },
    level: { code: 'L3', name: 'Senior' },
    status: 'active',
    hireDate: '2021-07-12',
    terminationDate: null,
    salary: { amountMinor: 198000000, currency: 'INR' },
    salaryUsd: { amountMinor: 2277000, currency: 'USD' },
    salaryEffectiveDate: '2026-04-01',
    compaRatio: 0.97,
    bandPosition: 'inside',
    ...overrides,
  });

export const anEmployeeListResponse = (
  overrides: Partial<EmployeeListResponse> = {},
): EmployeeListResponse =>
  employeeListResponseSchema.parse({
    items: [anEmployeeListItem()],
    page: 1,
    pageSize: 50,
    total: 1,
    totalPages: 1,
    fxAsOf: '2026-09-30',
    ...overrides,
  });

/** `count` distinct employees, ids from `firstId`. */
export const someEmployees = (count: number, firstId = 1): EmployeeListItem[] =>
  Array.from({ length: count }, (_, index) =>
    anEmployeeListItem({
      id: firstId + index,
      employeeCode: `E${String(firstId + index).padStart(6, '0')}`,
      firstName: `First${firstId + index}`,
      lastName: `Last${firstId + index}`,
    }),
  );

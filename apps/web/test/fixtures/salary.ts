import {
  salaryChangeItemSchema,
  salaryHistoryResponseSchema,
  type SalaryChangeItem,
  type SalaryHistoryResponse,
} from '@acme/shared';

// Fixture builders parse with the shared response schema (D-050).
export const aSalaryChangeItem = (overrides: Partial<SalaryChangeItem> = {}): SalaryChangeItem =>
  salaryChangeItemSchema.parse({
    id: 1,
    effectiveDate: '2021-07-12',
    reason: 'hire',
    amount: { amountMinor: 150000000, currency: 'INR' },
    previousAmount: null,
    changePct: null,
    jobTitle: { id: 1, name: 'Software Engineer' },
    level: { code: 'L2', name: 'Intermediate' },
    previousJobTitle: null,
    previousLevel: null,
    changedBy: null,
    createdAt: '2021-07-12T00:00:00.000Z',
    ...overrides,
  });

export const aSalaryHistory = (items: SalaryChangeItem[]): SalaryHistoryResponse =>
  salaryHistoryResponseSchema.parse({ items });

/** Newest first: a promotion by HR Admin (L2 to L3, +4.2%), a seeded merit raise, the hire. */
export const aThreeRowHistory = (): SalaryHistoryResponse =>
  aSalaryHistory([
    aSalaryChangeItem({
      id: 3,
      effectiveDate: '2026-04-01',
      reason: 'promotion',
      amount: { amountMinor: 198000000, currency: 'INR' },
      previousAmount: { amountMinor: 190000000, currency: 'INR' },
      changePct: 4.2,
      level: { code: 'L3', name: 'Senior' },
      previousJobTitle: { id: 1, name: 'Software Engineer' },
      previousLevel: { code: 'L2', name: 'Intermediate' },
      changedBy: { displayName: 'HR Admin (demo)' },
    }),
    aSalaryChangeItem({
      id: 2,
      effectiveDate: '2023-04-01',
      reason: 'merit',
      amount: { amountMinor: 190000000, currency: 'INR' },
      previousAmount: { amountMinor: 150000000, currency: 'INR' },
      changePct: 26.7,
      previousJobTitle: { id: 1, name: 'Software Engineer' },
      previousLevel: { code: 'L2', name: 'Intermediate' },
    }),
    aSalaryChangeItem(),
  ]);

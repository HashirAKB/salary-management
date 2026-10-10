import { describe, expect, it } from 'vitest';
import { checkSalaryChange, type SalaryChangeContext } from './salary-rules.ts';

// A valid merit raise for an active employee; each test overrides what it exercises.
function context(
  override: {
    today?: string;
    employee?: Partial<SalaryChangeContext['employee']>;
    change?: Partial<SalaryChangeContext['change']>;
    hasPayBand?: boolean;
  } = {},
): SalaryChangeContext {
  return {
    today: override.today ?? '2026-10-09',
    employee: {
      status: 'active',
      salary: { amountMinor: 200_000_000, currency: 'INR' },
      salaryEffectiveDate: '2026-04-01',
      jobTitleId: 1,
      levelRank: 2,
      ...override.employee,
    },
    change: {
      reason: 'merit',
      effectiveDate: '2026-10-09',
      amount: { amountMinor: 206_000_000, currency: 'INR' },
      jobTitleId: 1,
      levelRank: 2,
      ...override.change,
    },
    hasPayBand: override.hasPayBand ?? true,
  };
}

describe('checkSalaryChange: dates (D-022)', () => {
  it('accepts an effective date equal to the current salary date', () => {
    expect(checkSalaryChange(context({ change: { effectiveDate: '2026-04-01' } }))).toBeNull();
  });

  it('accepts an effective date equal to today', () => {
    expect(checkSalaryChange(context({ change: { effectiveDate: '2026-10-09' } }))).toBeNull();
  });

  it('rejects a date after today', () => {
    expect(checkSalaryChange(context({ change: { effectiveDate: '2026-10-10' } }))).toBe(
      'DATE_IN_FUTURE',
    );
  });

  it('rejects a date before the current salary date', () => {
    expect(checkSalaryChange(context({ change: { effectiveDate: '2026-03-31' } }))).toBe(
      'SALARY_DATE_BEFORE_CURRENT',
    );
  });
});

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

describe.each(['merit', 'market_adjustment'] as const)(
  'checkSalaryChange: %s (D-022)',
  (reason) => {
    it('accepts a higher amount with the same title and level', () => {
      expect(checkSalaryChange(context({ change: { reason } }))).toBeNull();
    });

    it.each([
      { case: 'an equal amount', amountMinor: 200_000_000 },
      { case: 'a lower amount', amountMinor: 190_000_000 },
    ])('requires a raise: $case', ({ amountMinor }) => {
      const change = { reason, amount: { amountMinor, currency: 'INR' } };
      expect(checkSalaryChange(context({ change }))).toBe('RAISE_REQUIRED');
    });

    it.each([
      { case: 'a new title', change: { jobTitleId: 2 } },
      { case: 'a new level', change: { levelRank: 3 } },
    ])('keeps the position: $case', ({ change }) => {
      expect(checkSalaryChange(context({ change: { reason, ...change } }))).toBe(
        'POSITION_MUST_NOT_CHANGE',
      );
    });

    it('reports the raise before the position', () => {
      const change = {
        reason,
        amount: { amountMinor: 200_000_000, currency: 'INR' },
        jobTitleId: 2,
      };
      expect(checkSalaryChange(context({ change }))).toBe('RAISE_REQUIRED');
    });
  },
);

describe('checkSalaryChange: promotion (D-022)', () => {
  const promotion = { reason: 'promotion' as const, levelRank: 3 };

  it('accepts a higher amount and a higher level', () => {
    expect(checkSalaryChange(context({ change: promotion }))).toBeNull();
  });

  it('allows a new job title', () => {
    expect(checkSalaryChange(context({ change: { ...promotion, jobTitleId: 2 } }))).toBeNull();
  });

  it.each([
    { case: 'an equal amount', amountMinor: 200_000_000 },
    { case: 'a lower amount', amountMinor: 190_000_000 },
  ])('requires a raise: $case', ({ amountMinor }) => {
    const change = { ...promotion, amount: { amountMinor, currency: 'INR' } };
    expect(checkSalaryChange(context({ change }))).toBe('RAISE_REQUIRED');
  });

  it.each([
    { case: 'the same level', levelRank: 2 },
    { case: 'a lower level', levelRank: 1 },
  ])('requires a higher level: $case', ({ levelRank }) => {
    const change = { ...promotion, levelRank, jobTitleId: 2 };
    expect(checkSalaryChange(context({ change }))).toBe('PROMOTION_LEVEL_NOT_HIGHER');
  });

  it('reports the raise before the level', () => {
    const change = {
      ...promotion,
      levelRank: 2,
      amount: { amountMinor: 200_000_000, currency: 'INR' },
    };
    expect(checkSalaryChange(context({ change }))).toBe('RAISE_REQUIRED');
  });
});

describe('checkSalaryChange: correction (D-022)', () => {
  const correction = { reason: 'correction' as const };

  it('allows a lower amount', () => {
    const change = { ...correction, amount: { amountMinor: 190_000_000, currency: 'INR' } };
    expect(checkSalaryChange(context({ change }))).toBeNull();
  });

  it('allows a higher amount with a new title or level', () => {
    expect(checkSalaryChange(context({ change: { ...correction, jobTitleId: 2 } }))).toBeNull();
    expect(checkSalaryChange(context({ change: { ...correction, levelRank: 1 } }))).toBeNull();
  });

  it('allows the same amount with a new title or level', () => {
    const amount = { amountMinor: 200_000_000, currency: 'INR' };
    expect(
      checkSalaryChange(context({ change: { ...correction, amount, jobTitleId: 2 } })),
    ).toBeNull();
    expect(
      checkSalaryChange(context({ change: { ...correction, amount, levelRank: 3 } })),
    ).toBeNull();
  });

  it('rejects a change that changes nothing', () => {
    const amount = { amountMinor: 200_000_000, currency: 'INR' };
    expect(checkSalaryChange(context({ change: { ...correction, amount } }))).toBe(
      'CORRECTION_NO_CHANGE',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { salaryChangeBodySchema } from './salary.ts';

const valid = {
  effectiveDate: '2026-10-09',
  reason: 'merit',
  amount: { amountMinor: 206_000_000, currency: 'INR' },
  jobTitleId: 1,
  levelCode: 'L3',
};

describe('salaryChangeBodySchema', () => {
  it('accepts a complete body', () => {
    expect(salaryChangeBodySchema.safeParse(valid).success).toBe(true);
  });

  it.each(['merit', 'promotion', 'market_adjustment', 'correction'])(
    'accepts reason %s',
    (reason) => {
      expect(salaryChangeBodySchema.safeParse({ ...valid, reason }).success).toBe(true);
    },
  );

  it('rejects the hire reason', () => {
    expect(salaryChangeBodySchema.safeParse({ ...valid, reason: 'hire' }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(salaryChangeBodySchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });

  it.each([0, -1, 1.5, 1_000_000_000_001])('rejects amountMinor %s', (amountMinor) => {
    const body = { ...valid, amount: { amountMinor, currency: 'INR' } };
    expect(salaryChangeBodySchema.safeParse(body).success).toBe(false);
  });

  it.each([1, 1_000_000_000_000])('accepts amountMinor %s', (amountMinor) => {
    const body = { ...valid, amount: { amountMinor, currency: 'INR' } };
    expect(salaryChangeBodySchema.safeParse(body).success).toBe(true);
  });

  it.each(['effectiveDate', 'reason', 'amount', 'jobTitleId', 'levelCode'])(
    'requires %s',
    (key) => {
      const body: Record<string, unknown> = { ...valid };
      delete body[key];
      expect(salaryChangeBodySchema.safeParse(body).success).toBe(false);
    },
  );
});

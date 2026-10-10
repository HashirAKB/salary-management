import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatChangePct,
  formatCompaRatio,
  formatDate,
  formatGapPct,
  formatMoney,
  formatSharePct,
  parseMajorToMinor,
} from './format.ts';

describe('formatMoney (04 section 8.4)', () => {
  it.each([
    [{ amountMinor: 204800000, currency: 'INR' }, 'INR 20,48,000'],
    [{ amountMinor: 2355200, currency: 'USD' }, 'USD 23,552'],
    [{ amountMinor: 1234500, currency: 'CAD' }, 'CAD 12,345'],
  ])('formats %j as %s', (money, expected) => {
    expect(formatMoney(money)).toBe(expected);
  });
});

describe('formatDate (04 section 8.4)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('formats an ISO date as 9 Oct 2026', () => {
    expect(formatDate('2026-10-09')).toBe('9 Oct 2026');
  });

  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
    'does not shift the day in the %s zone',
    (zone) => {
      vi.stubEnv('TZ', zone);
      expect(formatDate('2026-10-09')).toBe('9 Oct 2026');
    },
  );
});

describe('parseMajorToMinor (04 section 8.4)', () => {
  it.each([
    ['0.29', 29],
    ['20480.50', 2048050],
    ['20480', 2048000],
    ['0', 0],
  ])('converts %s to %d by string parsing', (input, minor) => {
    expect(parseMajorToMinor(input)).toBe(minor);
  });

  it.each(['1.234', '', 'abc', '-1', '1.'])('rejects %j', (input) => {
    expect(parseMajorToMinor(input)).toBeNull();
  });
});

describe('percentages and compa-ratio (04 section 8.4.1)', () => {
  it.each<[number | null, string]>([
    [4.2, '+4.2%'],
    [-1.0, '-1.0%'],
    [0, '0.0%'],
    [-0, '0.0%'],
    [0.04, '0.0%'],
    [-0.04, '0.0%'],
    [null, 'n/a'],
    [0.05, '+0.1%'],
    [-0.05, '-0.1%'],
  ])('shows a salary change of %s as %s', (value, expected) => {
    expect(formatChangePct(value)).toBe(expected);
  });

  it.each<[number | null, string]>([
    [8.0, '8.0%'],
    [-1.2, '-1.2%'],
    [0.04, '0.0%'],
    [-0.04, '0.0%'],
    [null, 'Too few to compare'],
  ])('shows a gender gap of %s as %s', (value, expected) => {
    expect(formatGapPct(value)).toBe(expected);
  });

  it.each<[number | null, string]>([
    [40, '40.0%'],
    [0.04, '0.0%'],
    [null, 'n/a'],
  ])('shows a share of %s as %s', (value, expected) => {
    expect(formatSharePct(value)).toBe(expected);
  });

  it('shows a compa-ratio to two decimals', () => {
    expect(formatCompaRatio(0.97)).toBe('0.97');
    expect(formatCompaRatio(1)).toBe('1.00');
  });
});

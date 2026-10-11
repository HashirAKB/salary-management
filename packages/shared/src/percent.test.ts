import { describe, expect, it } from 'vitest';
import { changePct, compaRatio, gapPct, sharePct } from './percent.ts';

describe('compaRatio', () => {
  // 04 section 8.4.1: hundredths = salary * 100 / mid, rounded half away from zero in integers.
  it.each([
    {
      case: 'a tie rounds up, not to floating-point 1.00',
      salary: 100_500,
      mid: 100_000,
      ratio: 1.01,
    },
    { case: 'exactly the midpoint', salary: 100_000, mid: 100_000, ratio: 1 },
    { case: 'below the midpoint', salary: 97_000, mid: 100_000, ratio: 0.97 },
    { case: 'rounds down below half', salary: 100_499, mid: 100_000, ratio: 1 },
    { case: 'rounds up above half', salary: 100_501, mid: 100_000, ratio: 1.01 },
    { case: 'a large ratio', salary: 250_000, mid: 100_000, ratio: 2.5 },
    { case: 'a negative tie rounds away from zero', salary: -100_500, mid: 100_000, ratio: -1.01 },
  ])('$case', ({ salary, mid, ratio }) => {
    expect(compaRatio(salary, mid)).toBe(ratio);
  });

  it('never returns -0', () => {
    expect(Object.is(compaRatio(-1, 100_000), 0)).toBe(true);
  });
});

describe('changePct', () => {
  // 04 section 8.4.1: tenths = (next - prev) * 1000 / prev, rounded half away from zero.
  it.each([
    { case: 'a tie rounds up', next: 100_050, pct: 0.1 },
    { case: 'below half rounds to zero', next: 100_040, pct: 0 },
    { case: 'a small decrease rounds to zero', next: 99_960, pct: 0 },
    { case: 'a negative tie rounds away from zero', next: 99_950, pct: -0.1 },
    { case: 'a plain raise', next: 104_200, pct: 4.2 },
    { case: 'a plain cut', next: 99_000, pct: -1 },
  ])('$case', ({ next, pct }) => {
    expect(changePct(100_000, next)).toBe(pct);
  });

  it('never returns -0', () => {
    expect(Object.is(changePct(100_000, 99_960), 0)).toBe(true);
  });
});

describe('gapPct', () => {
  // 04 section 8.4.1: tenths = (men - women) * 1000 / men, rounded half away from zero.
  it.each([
    { case: 'women paid less is positive', men: 100_000, women: 92_000, pct: 8 },
    { case: 'women paid more is negative', men: 100_000, women: 101_200, pct: -1.2 },
    { case: 'equal pay is zero', men: 100_000, women: 100_000, pct: 0 },
    { case: 'a positive tie rounds up', men: 100_000, women: 99_950, pct: 0.1 },
    { case: 'a negative tie rounds away from zero', men: 100_000, women: 100_050, pct: -0.1 },
    { case: 'below half rounds down', men: 100_000, women: 99_960, pct: 0 },
  ])('$case', ({ men, women, pct }) => {
    expect(gapPct(men, women)).toBe(pct);
  });

  it('a gap under 0.05% either way is 0, never -0', () => {
    expect(Object.is(gapPct(100_000, 99_960), 0)).toBe(true);
    expect(Object.is(gapPct(100_000, 100_040), 0)).toBe(true);
  });
});

describe('sharePct', () => {
  // 04 section 8.4.1: tenths = part * 1000 / total, rounded half away from zero.
  it.each([
    { case: 'a plain share', part: 40, total: 100, pct: 40 },
    { case: 'zero part', part: 0, total: 100, pct: 0 },
    { case: 'the whole', part: 100, total: 100, pct: 100 },
    { case: 'a tie rounds up', part: 1, total: 2000, pct: 0.1 },
    { case: 'below half rounds down', part: 1, total: 2001, pct: 0 },
    { case: 'one third', part: 1, total: 3, pct: 33.3 },
  ])('$case', ({ part, total, pct }) => {
    expect(sharePct(part, total)).toBe(pct);
  });
});

import { describe, expect, it } from 'vitest';
import { changePct, compaRatio } from './percent.ts';

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

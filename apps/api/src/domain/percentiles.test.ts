import { describe, expect, it } from 'vitest';
import { EXCEL_PERCENTILES, EXCEL_SALARIES } from './__fixtures__/pay-rows.ts';
import { percentile } from './percentiles.ts';

describe('percentile (D-024, Excel PERCENTILE.INC)', () => {
  it.each([
    { p: 0.25, expected: 1.75 },
    { p: 0.5, expected: 2.5 },
    { p: 0.75, expected: 3.25 },
  ])('[1,2,3,4] at $p is $expected', ({ p, expected }) => {
    expect(percentile([1, 2, 3, 4], p)).toBeCloseTo(expected, 10);
  });

  it('a single value is its own P25, median and P75, and the input is not mutated', () => {
    const single = [42];
    expect([0.25, 0.5, 0.75].map((p) => percentile(single, p))).toEqual([42, 42, 42]);

    const unsorted = [3, 1, 2];
    percentile(unsorted, 0.5);
    expect(unsorted).toEqual([3, 1, 2]);
  });

  it('matches the Excel results stored with the pay-rows fixture', () => {
    expect(percentile(EXCEL_SALARIES, 0)).toBe(EXCEL_PERCENTILES.min);
    expect(percentile(EXCEL_SALARIES, 0.25)).toBe(EXCEL_PERCENTILES.p25);
    expect(percentile(EXCEL_SALARIES, 0.5)).toBe(EXCEL_PERCENTILES.median);
    expect(percentile(EXCEL_SALARIES, 0.75)).toBe(EXCEL_PERCENTILES.p75);
    expect(percentile(EXCEL_SALARIES, 1)).toBe(EXCEL_PERCENTILES.max);
  });
});

import { describe, expect, it } from 'vitest';
import { createRandom, largestRemainder, normalFrom } from './random.ts';

const draws = (n: number, draw: () => number) => Array.from({ length: n }, draw);

describe('largestRemainder', () => {
  it.each([
    { total: 10, weights: [1, 1, 1], counts: [4, 3, 3] },
    { total: 5, weights: [2, 2, 1], counts: [2, 2, 1] },
    { total: 7, weights: [0.5, 0.3, 0.2], counts: [4, 2, 1] },
    // 02 section 7.5: IN / Software Engineer / L3 has 280 people and w = 0.28.
    { total: 280, weights: [0.97 * 0.28, 0.97 * 0.72, 0.01, 0.02], counts: [76, 195, 3, 6] },
    { total: 0, weights: [0.6, 0.4], counts: [0, 0] },
  ])(
    'allocates counts that sum exactly to the total: $total over $weights',
    ({ total, weights, counts }) => {
      const result = largestRemainder(total, weights);

      expect(result).toEqual(counts);
      expect(result.reduce((a, b) => a + b, 0)).toBe(total);
    },
  );

  it('allocates counts that sum exactly to the total for the 02 section 7.3 title shares', () => {
    const titleShares = [0.28, 0.07, 0.04, 0.04, 0.15, 0.07, 0.05, 0.04, 0.1, 0.16];

    for (const total of [4000, 2500, 1500, 1200, 800, 13]) {
      expect(largestRemainder(total, titleShares).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe('createRandom', () => {
  it('the seeded normal generator returns the same values for the same seed', () => {
    const first = createRandom(20261011);
    const second = createRandom(20261011);
    const other = createRandom(20261012);

    const a = draws(20, () => first.normal(1, 0.06));
    const b = draws(20, () => second.normal(1, 0.06));
    const c = draws(20, () => other.normal(1, 0.06));

    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('the seeded uniform generator and shuffle repeat for the same seed and stay in range', () => {
    const first = createRandom(7);
    const second = createRandom(7);
    const items = Array.from({ length: 50 }, (_, i) => i);

    const uniforms = draws(1000, () => first.next());
    const ints = draws(1000, () => first.int(3, 6));
    const shuffled = first.shuffle(items);

    expect(draws(1000, () => second.next())).toEqual(uniforms);
    expect(draws(1000, () => second.int(3, 6))).toEqual(ints);
    expect(second.shuffle(items)).toEqual(shuffled);
    expect(uniforms.every((u) => u >= 0 && u < 1)).toBe(true);
    expect(new Set(ints)).toEqual(new Set([3, 4, 5, 6]));
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(items[0]).toBe(0);
  });
});

describe('normalFrom (Box-Muller)', () => {
  it('normal draws have mean near 0 and standard deviation near 1 over 10,000 samples', () => {
    const random = createRandom(1);
    const samples = draws(10_000, () => normalFrom(() => random.next()));

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);

    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
});

// Seeded randomness for the seed (02 section 7.2, D-051). Never reads Math.random.

export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform in [min, max). */
  uniform(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Normal draw with the given mean and standard deviation. */
  normal(mean: number, sd: number): number;
  /** A shuffled copy; the input is not changed. */
  shuffle<T>(items: readonly T[]): T[];
}

// mulberry32: a small 32-bit generator, plenty for 10,000 rows and stable across platforms.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandom(seed: number): Random {
  const next = mulberry32(seed);
  const random: Random = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    uniform: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    normal: (mean, sd) => mean + sd * normalFrom(next),
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = random.int(0, i);
        [copy[i], copy[j]] = [copy[j] as (typeof copy)[number], copy[i] as (typeof copy)[number]];
      }
      return copy;
    },
  };
  return random;
}

// Box-Muller: one standard normal draw from two uniforms (02 section 7.2).
export function normalFrom(uniform: () => number): number {
  const u1 = 1 - uniform(); // (0, 1], so the log is finite
  const u2 = uniform();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Splits total in proportion to weights so the parts sum exactly to total (02 section 7.5).
// Leftover units go to the largest remainders; ties go to the earlier index.
export function largestRemainder(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left === 0) break;
    counts[index] = (counts[index] ?? 0) + 1;
    left--;
  }
  return counts;
}

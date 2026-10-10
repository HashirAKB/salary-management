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

export function createRandom(_seed: number): Random {
  throw new Error('not implemented');
}

export function normalFrom(_uniform: () => number): number {
  throw new Error('not implemented');
}

export function largestRemainder(_total: number, _weights: readonly number[]): number[] {
  throw new Error('not implemented');
}

// D-024: PERCENTILE.INC, h = (n - 1) * p, linear interpolation. Returns the unrounded value.
export function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lower = Math.floor(h);
  const low = sorted[lower]!;
  if (lower + 1 >= sorted.length) return low;
  return low + (h - lower) * (sorted[lower + 1]! - low);
}

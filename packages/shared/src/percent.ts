// 04 section 8.4.1: integer arithmetic on minor units, rounded half away from zero.
// `Math.round` is not used; a result of zero is never `-0`.
export function compaRatio(salaryMinor: number, midMinor: number): number {
  const numerator = Math.abs(salaryMinor) * 100;
  const hundredths = Math.floor((numerator * 2 + midMinor) / (midMinor * 2));
  return salaryMinor < 0 && hundredths !== 0 ? -hundredths / 100 : hundredths / 100;
}

// Change as a percentage of the previous amount, to 1 decimal: tenths = (next - prev) * 1000 / prev.
export function changePct(prevMinor: number, nextMinor: number): number {
  const numerator = Math.abs(nextMinor - prevMinor) * 1000;
  const tenths = Math.floor((numerator * 2 + prevMinor) / (prevMinor * 2));
  return nextMinor < prevMinor && tenths !== 0 ? -tenths / 10 : tenths / 10;
}

// Gender gap to 1 decimal: tenths = (men - women) * 1000 / men. Positive when women are paid less.
export function gapPct(_menMinor: number, _womenMinor: number): number {
  throw new Error('not implemented');
}

// Share to 1 decimal: tenths = part * 1000 / total.
export function sharePct(_part: number, _total: number): number {
  throw new Error('not implemented');
}

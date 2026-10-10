// 04 section 8.4.1: integer arithmetic on minor units, rounded half away from zero.
// `Math.round` is not used; a result of zero is never `-0`.
export function compaRatio(salaryMinor: number, midMinor: number): number {
  const numerator = Math.abs(salaryMinor) * 100;
  const hundredths = Math.floor((numerator * 2 + midMinor) / (midMinor * 2));
  return salaryMinor < 0 && hundredths !== 0 ? -hundredths / 100 : hundredths / 100;
}

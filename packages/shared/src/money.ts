// Converts one positive amount to USD minor units, half up to the cent (02 section 4, D-023).
// Convert each employee first, then aggregate; never convert an aggregate.
export function toUsdMinor(amountMinor: number, usdPerUnitMicros: number): number {
  return Math.round((amountMinor * usdPerUnitMicros) / 1_000_000);
}

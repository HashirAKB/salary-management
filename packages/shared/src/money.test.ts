import { describe, expect, it } from 'vitest';
import { toUsdMinor } from './money.ts';

describe('toUsdMinor', () => {
  // 02 section 4: usdMinor = round(amountMinor * usdPerUnitMicros / 1_000_000), half up to the cent.
  it.each([
    { case: 'USD stays the same', amountMinor: 9_500_000, micros: 1_000_000, usdMinor: 9_500_000 },
    { case: 'GBP at 1.34', amountMinor: 100, micros: 1_340_000, usdMinor: 134 },
    {
      case: 'EUR rounds down below half',
      amountMinor: 12_345,
      micros: 1_160_000,
      usdMinor: 14_320,
    },
    { case: 'an exact half rounds up', amountMinor: 50, micros: 1_010_000, usdMinor: 51 },
    { case: 'INR just above half rounds up', amountMinor: 50, micros: 11_500, usdMinor: 1 },
    { case: 'INR just below half rounds down', amountMinor: 130, micros: 11_500, usdMinor: 1 },
    { case: 'INR 1.5 crore', amountMinor: 1_500_000_000, micros: 11_500, usdMinor: 17_250_000 },
  ])('rounds half up to the cent: $case', ({ amountMinor, micros, usdMinor }) => {
    expect(toUsdMinor(amountMinor, micros)).toBe(usdMinor);
  });
});

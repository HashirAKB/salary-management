export type MoneyValue = { amountMinor: number; currency: string };

const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter;
}

/** `INR 20,48,000`, `USD 23,552`: whole major units, code before the number. */
export function formatMoney({ amountMinor, currency }: MoneyValue): string {
  return moneyFormatter(currency)
    .format(amountMinor / 100)
    .replace(/\s/g, ' ');
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `2026-10-09` to `9 Oct 2026`, in UTC whatever the machine's zone. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Parses major units ("20480.50") to minor units by string parsing; null when invalid. */
export function parseMajorToMinor(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  return Number(whole + fraction.padEnd(2, '0'));
}

export function formatPct(_value: number, _options?: { signed?: boolean }): string {
  throw new Error('not implemented');
}

export function formatChangePct(_value: number | null): string {
  throw new Error('not implemented');
}

export function formatGapPct(_value: number | null): string {
  throw new Error('not implemented');
}

export function formatSharePct(_value: number | null): string {
  throw new Error('not implemented');
}

export function formatCompaRatio(_value: number): string {
  throw new Error('not implemented');
}

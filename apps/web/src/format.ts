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

/**
 * `2026-10-09` to `9 Oct 2026`, in UTC whatever the machine's zone. ICU's en-GB writes September
 * as `Sept`; 04 section 8.4 shows `Sep`, so the month is normalised.
 */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`)).replace(' Sept ', ' Sep ');
}

/** Parses major units ("20480.50") to minor units by string parsing; null when invalid. */
export function parseMajorToMinor(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  return Number(whole + fraction.padEnd(2, '0'));
}

const pctFormatters = {
  signed: new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }),
  unsigned: new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'negative',
  }),
};

/** One decimal; a value that rounds to zero shows `0.0%` with no sign (04 section 8.4.1). */
export function formatPct(value: number, { signed = false }: { signed?: boolean } = {}): string {
  return `${pctFormatters[signed ? 'signed' : 'unsigned'].format(value)}%`;
}

export const formatChangePct = (value: number | null): string =>
  value === null ? 'n/a' : formatPct(value, { signed: true });

export const formatGapPct = (value: number | null): string =>
  value === null ? 'Too few to compare' : formatPct(value);

export const formatSharePct = (value: number | null): string =>
  value === null ? 'n/a' : formatPct(value);

const compaFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCompaRatio = (value: number): string => compaFormatter.format(value);

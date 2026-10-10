export type MoneyValue = { amountMinor: number; currency: string };

export function formatMoney(_money: MoneyValue): string {
  throw new Error('not implemented');
}

export function formatDate(_isoDate: string): string {
  throw new Error('not implemented');
}

/** Parses major units ("20480.50") to minor units by string parsing; null when invalid. */
export function parseMajorToMinor(_input: string): number | null {
  throw new Error('not implemented');
}

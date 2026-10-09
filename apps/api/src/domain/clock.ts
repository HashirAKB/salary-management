export interface Clock {
  /** The current instant. */
  now(): Date;
  /** Today's date in UTC as YYYY-MM-DD (03 section 6, rule 8). */
  today(): string;
}

export type FixedClock = Clock & { advance(ms: number): void };

export const systemClock: Clock = {
  now: () => {
    throw new Error('not implemented');
  },
  today: () => {
    throw new Error('not implemented');
  },
};

export function fixedClock(_iso: string): FixedClock {
  throw new Error('not implemented');
}

// The only module allowed to read the system time (D-051).
export interface Clock {
  /** The current instant. */
  now(): Date;
  /** Today's date in UTC as YYYY-MM-DD (03 section 6, rule 8). */
  today(): string;
}

export type FixedClock = Clock & { advance(ms: number): void };

const utcDate = (instant: Date): string => instant.toISOString().slice(0, 10);

export const systemClock: Clock = {
  now: () => new Date(),
  today: () => utcDate(new Date()),
};

export function fixedClock(iso: string): FixedClock {
  let ms = new Date(iso).getTime();
  return {
    now: () => new Date(ms),
    today: () => utcDate(new Date(ms)),
    advance: (by) => {
      ms += by;
    },
  };
}

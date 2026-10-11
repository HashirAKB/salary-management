export type ConnectionState = 'ok' | 'slow' | 'waking' | 'down';

/** Timers the connection store uses; tests inject a manual one (D-045). */
export type Scheduler = {
  /** Runs `fn` once after `ms`; returns the cancel function. */
  after(ms: number, fn: () => void): () => void;
  /** Runs `fn` every `ms`; returns the cancel function. */
  every(ms: number, fn: () => void): () => void;
};

export const connection = {
  setScheduler(_scheduler: Scheduler): void {
    throw new Error('not implemented');
  },
  reset(): void {
    throw new Error('not implemented');
  },
};

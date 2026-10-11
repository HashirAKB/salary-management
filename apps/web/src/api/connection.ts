export type ConnectionState = 'ok' | 'slow' | 'waking' | 'down';

/** Timers the connection store uses; tests inject a manual one (D-045). */
export type Scheduler = {
  /** Runs `fn` once after `ms`; returns the cancel function. */
  after(ms: number, fn: () => void): () => void;
  /** Runs `fn` every `ms`; returns the cancel function. */
  every(ms: number, fn: () => void): () => void;
};

const SLOW_AFTER_MS = 4000;

const realScheduler: Scheduler = {
  after(ms, fn) {
    const handle = setTimeout(fn, ms);
    return () => clearTimeout(handle);
  },
  every(ms, fn) {
    const handle = setInterval(fn, ms);
    return () => clearInterval(handle);
  },
};

let scheduler = realScheduler;
let state: ConnectionState = 'ok';
let pending = 0;
const listeners = new Set<() => void>();

function setState(next: ConnectionState): void {
  if (state === next) return;
  state = next;
  listeners.forEach((listener) => listener());
}

/** The connection store (04 section 8.3): a tiny external store read with `useSyncExternalStore`. */
export const connection = {
  getState: (): ConnectionState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Starts the 4-second slow timer for a request; returns the function to call when it ends. */
  requestStarted(): () => void {
    pending += 1;
    const cancel = scheduler.after(SLOW_AFTER_MS, () => {
      if (state === 'ok') setState('slow');
    });
    return () => {
      cancel();
      pending -= 1;
      if (pending === 0 && state === 'slow') setState('ok');
    };
  },
  /** A request hit a sleeping server. */
  serverWaking(): void {
    setState('waking');
  },
  setScheduler(next: Scheduler): void {
    scheduler = next;
  },
  /** Back to the real timers and a healthy state (tests). */
  reset(): void {
    scheduler = realScheduler;
    pending = 0;
    state = 'ok';
    listeners.forEach((listener) => listener());
  },
};

export type ConnectionState = 'ok' | 'slow' | 'waking' | 'down';

/** Timers the connection store uses; tests inject a manual one (D-045). */
export type Scheduler = {
  /** Runs `fn` once after `ms`; returns the cancel function. */
  after(ms: number, fn: () => void): () => void;
  /** Runs `fn` every `ms`; returns the cancel function. */
  every(ms: number, fn: () => void): () => void;
};

const SLOW_AFTER_MS = 4000;
const POLL_EVERY_MS = 3000;
const DOWN_AFTER_MS = 90_000;

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
let cancelPoll: (() => void) | undefined;
let cancelDown: (() => void) | undefined;
let polling = false;
let waiters: ((awake: boolean) => void)[] = [];
const listeners = new Set<() => void>();

function setState(next: ConnectionState): void {
  if (state === next) return;
  state = next;
  listeners.forEach((listener) => listener());
}

function stopTimers(): void {
  cancelPoll?.();
  cancelDown?.();
  cancelPoll = cancelDown = undefined;
}

function startWaking(): void {
  setState('waking');
  cancelPoll = scheduler.every(POLL_EVERY_MS, () => void poll());
  cancelDown = scheduler.after(DOWN_AFTER_MS, () => {
    stopTimers();
    setState('down');
    settle(false);
  });
}

function settle(awake: boolean): void {
  const done = waiters;
  waiters = [];
  done.forEach((resolve) => resolve(awake));
}

async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const response = await fetch('/api/health');
    const healthy = response.ok && (response.headers.get('content-type') ?? '').includes('json');
    if (healthy && state === 'waking') {
      stopTimers();
      setState('ok');
      settle(true);
    }
  } catch {
    // Still asleep; the next tick tries again.
  } finally {
    polling = false;
  }
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
    if (state === 'waking' || state === 'down') return;
    startWaking();
  },
  /** "Try again" on the server-down banner restarts the health poll. */
  tryAgain(): void {
    if (state === 'down') startWaking();
  },
  /** Resolves true once the server answers health again, so a failed GET can be retried. */
  recovered(): Promise<boolean> {
    if (state === 'ok' || state === 'slow') return Promise.resolve(true);
    if (state === 'down') return Promise.resolve(false);
    return new Promise((resolve) => waiters.push(resolve));
  },
  setScheduler(next: Scheduler): void {
    scheduler = next;
  },
  /** Back to the real timers and a healthy state (tests). */
  reset(): void {
    stopTimers();
    settle(false);
    scheduler = realScheduler;
    pending = 0;
    state = 'ok';
    listeners.forEach((listener) => listener());
  },
};

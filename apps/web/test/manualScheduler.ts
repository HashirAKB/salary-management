import type { Scheduler } from '../src/api/connection.ts';

type Timer = { at: number; fn: () => void; every?: number };

/** A scheduler whose clock only moves when a test calls `advance`. */
export function aManualScheduler(): Scheduler & { advance(ms: number): void } {
  let now = 0;
  const timers = new Set<Timer>();
  const add = (timer: Timer) => {
    timers.add(timer);
    return () => timers.delete(timer);
  };
  return {
    after: (ms, fn) => add({ at: now + ms, fn }),
    every: (ms, fn) => add({ at: now + ms, fn, every: ms }),
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers].filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        now = due.at;
        if (due.every) due.at += due.every;
        else timers.delete(due);
        due.fn();
      }
      now = target;
    },
  };
}

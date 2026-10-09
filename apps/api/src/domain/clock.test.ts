import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixedClock, systemClock } from './clock.ts';

describe('fixedClock', () => {
  it('returns its instant and its UTC date, and moves only on advance', () => {
    const clock = fixedClock('2026-10-09T23:30:00.000Z');

    expect(clock.now().toISOString()).toBe('2026-10-09T23:30:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-10-09T23:30:00.000Z');
    expect(clock.today()).toBe('2026-10-09');

    clock.advance(60 * 60 * 1000);

    expect(clock.now().toISOString()).toBe('2026-10-10T00:30:00.000Z');
    expect(clock.today()).toBe('2026-10-10');
  });
});

describe('systemClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the current system time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T09:00:00.000Z'));

    expect(systemClock.now().toISOString()).toBe('2026-10-09T09:00:00.000Z');
    expect(systemClock.today()).toBe('2026-10-09');
  });
});

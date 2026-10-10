import { describe, expect, it } from 'vitest';
import { personNameSchema } from './common.ts';

describe('PersonName', () => {
  it('accepts an ordinary name and trims it', () => {
    expect(personNameSchema.parse('  Asha ')).toBe('Asha');
  });

  it('accepts 100 characters', () => {
    expect(personNameSchema.safeParse('a'.repeat(100)).success).toBe(true);
  });

  it.each(['', '   '])('rejects an empty name %j', (name) => {
    expect(personNameSchema.safeParse(name).success).toBe(false);
  });

  it('rejects a name over 100 characters', () => {
    expect(personNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });

  it.each(['=cmd', '+1', '-1', '@sum', '\tTab'])(
    'rejects %j, which starts with a formula character',
    (name) => {
      expect(personNameSchema.safeParse(name).success).toBe(false);
    },
  );

  it('accepts a formula character that is not leading', () => {
    expect(personNameSchema.safeParse("Anne-Marie O'Neil").success).toBe(true);
  });
});

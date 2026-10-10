import { describe, expect, it } from 'vitest';
import { normaliseSearchText, parseSearch } from './employee-search.ts';

describe('parseSearch', () => {
  it.each(['4217', 'E4217', 'e004217', '004217', ' E4217 '])(
    'turns %j into the employee code E004217',
    (q) => {
      expect(parseSearch(q)).toEqual({ kind: 'code', code: 'E004217' });
    },
  );

  it.each([
    ['Jürgen', 'jurgen'],
    ['E12 Nair', 'e12 nair'],
    ['1234567', '1234567'],
    ['E', 'e'],
    ['50%_off', '50%_off'],
  ])('turns %j into the normalised name text %j', (q, text) => {
    expect(parseSearch(q)).toEqual({ kind: 'name', text });
  });
});

describe('normaliseSearchText', () => {
  it('removes diacritics, lower-cases and collapses spaces', () => {
    expect(normaliseSearchText('  Jürgen  MÜLLER ')).toBe('jurgen muller');
  });
});

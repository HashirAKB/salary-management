import { describe, expect, it } from 'vitest';
import { nameSearch } from './name-search.ts';

describe('nameSearch', () => {
  it.each([
    { first: 'Jörg', last: 'Müller', expected: 'jorg muller' },
    { first: '  Ana  María ', last: 'López ', expected: 'ana maria lopez' },
    { first: 'ZOË', last: 'Brontë', expected: 'zoe bronte' },
    { first: 'Priya', last: 'Iyer', expected: 'priya iyer' },
  ])(
    'normalises name_search to lower-case "first last" without diacritics: $first $last',
    ({ first, last, expected }) => {
      expect(nameSearch(first, last)).toBe(expected);
    },
  );
});

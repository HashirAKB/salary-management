import { normaliseSearchText } from './employee-search.ts';

// name_search (02 section 5): "first last", Unicode NFKD, diacritics removed, lower-cased,
// spaces collapsed. Search input is normalised the same way, so "muller" finds "Müller".
export function nameSearch(firstName: string, lastName: string): string {
  return normaliseSearchText(`${firstName} ${lastName}`);
}

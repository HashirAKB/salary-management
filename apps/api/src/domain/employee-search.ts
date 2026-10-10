export type EmployeeSearch = { kind: 'code'; code: string } | { kind: 'name'; text: string };

// Same normalisation as name_search (02 section 5), applied to the search text.
export function normaliseSearchText(_text: string): string {
  throw new Error('not implemented');
}

// 04 section 5.4 q: 4217, E4217 and e004217 are an employee code; anything else is a name.
export function parseSearch(_q: string): EmployeeSearch {
  throw new Error('not implemented');
}

export type EmployeeSearch = { kind: 'code'; code: string } | { kind: 'name'; text: string };

// Same normalisation as name_search (02 section 5), applied to the search text.
export function normaliseSearchText(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const CODE_PATTERN = /^E?0*(\d{1,6})$/i;

// 04 section 5.4 q: 4217, E4217 and e004217 are an employee code; anything else is a name.
export function parseSearch(q: string): EmployeeSearch {
  const trimmed = q.trim();
  const digits = CODE_PATTERN.exec(trimmed)?.[1];
  if (digits !== undefined) return { kind: 'code', code: `E${digits.padStart(6, '0')}` };
  return { kind: 'name', text: normaliseSearchText(trimmed) };
}

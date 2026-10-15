# S4 approved plan (branch s4-search-filters-export)

Rulings: see brief.md top (all A). Extra test added to cycle A: URL serializer round trip.

## Cycles (red test(scope) then green feat(scope))
A shared: list query schema + round trip | test(shared): parse comma lists and new list filters | feat(shared): extend list query schema
B employees: search parser, name/code search | test(employees): search by name without accents and by employee code | feat(employees): add name and code search
C employees: country/dept/title/level/gender/status filters, reference 400 with path, AND/OR | test(employees): filter by country, department, title, level, gender and status | feat(employees): add list filters
D employees: band + salaryUnchangedSince | test(employees): filter by band position and stale salary date | feat(employees): add band and stale-salary filters
E employees: sort, tie-break, strict params | test(employees): sort by usd salary with stable ties and reject unknown params | feat(employees): add sorting and strict query params
F export: csv.ts | test(export): write excel-safe csv with bom, crlf and formula guard | feat(export): add csv builder
G export: endpoint, headers, roles | test(export): export the same rows and order as the list | feat(export): add employee csv export endpoint
H web: url state, filter bar, reset page, debounce | test(web): keep list filters in the url and reset the page on change | feat(web): add filter bar and url state
I web: sort headers, unknown-value notice, empty filtered state | test(web): sort headers, unknown url values and empty filtered state | feat(web): add sort headers and url value validation
J web: Export CSV button | test(web): export the current filters as csv | feat(web): add export button

## Sessions
B1: A-C. B2: D-F. B3: G-I. B4: J. R: lint, coverage, spec-reviewer, handoff.

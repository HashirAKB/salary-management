import type { AskReference, CannotAnswerReason, StructuredQuery } from '@acme/shared';
import type { PayFilters } from '../insights/repo.ts';

export type CheckResult =
  | { kind: 'query'; query: StructuredQuery; filters: PayFilters }
  // `rule` names the semantic rule that refused the query (04 section 7.4 step 2).
  | { kind: 'cannot_answer'; reason: CannotAnswerReason; rule: 'genderGap' };

function idsOf<T extends { id: number; name: string }>(items: readonly T[], names: string[]) {
  return items.filter((item) => names.includes(item.name)).map((item) => item.id);
}

// 04 section 7.4 steps 2 and 3: semantic rules, then names to ids.
export function checkQuery(query: StructuredQuery, reference: AskReference): CheckResult {
  const { filters } = query;
  if (query.metric === 'genderGap' && (query.groupBy === 'gender' || filters.genders.length > 0)) {
    return { kind: 'cannot_answer', reason: 'unsupported', rule: 'genderGap' };
  }
  return {
    kind: 'query',
    query,
    filters: {
      countries: filters.countries,
      departmentIds: idsOf(reference.departments, filters.departments),
      jobTitleIds: idsOf(reference.jobTitles, filters.jobTitles),
      levelCodes: filters.levels,
      genders: filters.genders,
    },
  };
}

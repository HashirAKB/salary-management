import type { AskReference, CannotAnswerReason, StructuredQuery } from '@acme/shared';
import type { PayFilters } from '../insights/repo.ts';

export type CheckResult =
  | { kind: 'query'; query: StructuredQuery; filters: PayFilters }
  // `rule` names the semantic rule that refused the query (04 section 7.4 step 2).
  | { kind: 'cannot_answer'; reason: CannotAnswerReason; rule: 'genderGap' };

export function checkQuery(_query: StructuredQuery, _reference: AskReference): CheckResult {
  throw new Error('not implemented');
}

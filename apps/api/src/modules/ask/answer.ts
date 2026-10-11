import type { AskReference, CannotAnswerReason, StructuredQuery } from '@acme/shared';
import type { GroupResult } from '../../domain/pay-query.ts';

export const ANSWER_EXAMPLES = [
  'How does total payroll split by country?',
  'How many people are paid outside their band in the US?',
  'What is the gender pay gap for Account Executives by level?',
];

export function describeScope(
  _filters: StructuredQuery['filters'],
  _reference: AskReference,
): string {
  throw new Error('not implemented');
}

export function buildSentence(
  _query: StructuredQuery,
  _groups: readonly GroupResult[],
  _reference: AskReference,
): string {
  throw new Error('not implemented');
}

export function interpretationList(
  _query: StructuredQuery,
  _reference: AskReference,
): { label: string; value: string }[] {
  throw new Error('not implemented');
}

export function reasonMessage(_reason: CannotAnswerReason, _rule?: 'genderGap'): string {
  throw new Error('not implemented');
}

export function genderRuleSuggestion(_query: StructuredQuery, _reference: AskReference): string {
  throw new Error('not implemented');
}

import { z } from 'zod';

// 04 section 7.2: the run_pay_query input, mirrored as a zod schema.
export const ASK_METRICS = [
  'headcount',
  'total',
  'average',
  'median',
  'p25',
  'p75',
  'min',
  'max',
  'outsideBandCount',
  'genderGap',
] as const;

export const ASK_GROUP_BY = [
  'none',
  'country',
  'department',
  'jobTitle',
  'level',
  'gender',
] as const;

export const CANNOT_ANSWER_REASONS = [
  'individual',
  'trend',
  'edit',
  'multiple',
  'unsupported',
  'unclear',
  'offTopic',
] as const;

export type AskMetric = (typeof ASK_METRICS)[number];
export type AskGroupBy = (typeof ASK_GROUP_BY)[number];
export type CannotAnswerReason = (typeof CANNOT_ANSWER_REASONS)[number];

// The slice of the reference data (R1) the interpreter needs.
export interface AskReference {
  countries: { code: string; name: string }[];
  departments: { id: number; name: string }[];
  jobTitles: { id: number; name: string }[];
  levels: { code: string; name: string }[];
  genders: { code: string; name: string }[];
}

export interface StructuredQuery {
  metric: AskMetric;
  groupBy: AskGroupBy;
  filters: {
    countries: string[];
    departments: string[];
    jobTitles: string[];
    levels: string[];
    genders: string[];
  };
}

export function buildStructuredQuerySchema(_reference: AskReference): z.ZodType<StructuredQuery> {
  throw new Error('not implemented');
}

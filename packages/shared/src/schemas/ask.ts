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

// The API doesn't guarantee the capitalisation of enum values, so match case-insensitively
// and hand back the canonical spelling.
function caseInsensitiveEnum<T extends string>(values: readonly T[]) {
  return z.preprocess(
    (input) =>
      typeof input === 'string'
        ? (values.find((v) => v.toLowerCase() === input.toLowerCase()) ?? input)
        : input,
    z.enum(values as [T, ...T[]]),
  );
}

function filterList(values: readonly string[]) {
  return z.array(caseInsensitiveEnum(values)).max(values.length);
}

export function buildStructuredQuerySchema(reference: AskReference): z.ZodType<StructuredQuery> {
  return z.strictObject({
    metric: caseInsensitiveEnum(ASK_METRICS),
    groupBy: caseInsensitiveEnum(ASK_GROUP_BY),
    filters: z.strictObject({
      countries: filterList(reference.countries.map((c) => c.code)),
      departments: filterList(reference.departments.map((d) => d.name)),
      jobTitles: filterList(reference.jobTitles.map((j) => j.name)),
      levels: filterList(reference.levels.map((l) => l.code)),
      genders: filterList(reference.genders.map((g) => g.code)),
    }),
  });
}

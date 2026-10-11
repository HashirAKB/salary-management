import { ASK_GROUP_BY, ASK_METRICS, CANNOT_ANSWER_REASONS, type AskReference } from '@acme/shared';

export interface ToolDefinition {
  name: string;
  description: string;
  strict: true;
  input_schema: Record<string, unknown>;
}

function listOf(values: readonly string[]) {
  return { type: 'array', items: { type: 'string', enum: [...values] } };
}

// 04 section 7.2: built once at startup from the reference data.
export function buildToolSchemas(reference: AskReference): {
  runPayQuery: ToolDefinition;
  cannotAnswer: ToolDefinition;
} {
  const runPayQuery: ToolDefinition = {
    name: 'run_pay_query',
    description:
      "Run one aggregate pay query over ACME's active employees. Use for any question about headcount, salary statistics, payroll, people paid outside their pay band, or the gender pay gap, for the whole company or a subset.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: [...ASK_METRICS],
          description: 'Exactly one statistic. Salaries are annual gross base pay.',
        },
        groupBy: {
          type: 'string',
          enum: [...ASK_GROUP_BY],
          description: 'Split the result by one dimension, or none for a single figure.',
        },
        filters: {
          type: 'object',
          properties: {
            countries: listOf(reference.countries.map((c) => c.code)),
            departments: listOf(reference.departments.map((d) => d.name)),
            jobTitles: listOf(reference.jobTitles.map((j) => j.name)),
            levels: listOf(reference.levels.map((l) => l.code)),
            genders: listOf(reference.genders.map((g) => g.code)),
          },
          required: ['countries', 'departments', 'jobTitles', 'levels', 'genders'],
          additionalProperties: false,
        },
      },
      required: ['metric', 'groupBy', 'filters'],
      additionalProperties: false,
    },
  };

  const cannotAnswer: ToolDefinition = {
    name: 'cannot_answer',
    description:
      "Use when the question can't be answered with one aggregate pay query: it asks about a named person, a trend over time, a change to data, several statistics at once, pay outside base salary, or something unrelated or unclear.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: [...CANNOT_ANSWER_REASONS] },
        suggestion: {
          type: 'string',
          description: 'One answerable question close to what the user asked, in plain English.',
        },
      },
      required: ['reason', 'suggestion'],
      additionalProperties: false,
    },
  };

  return { runPayQuery, cannotAnswer };
}

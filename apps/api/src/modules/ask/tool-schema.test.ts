import { buildStructuredQuerySchema, type AskReference } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { buildToolSchemas } from './tool-schema.ts';

const reference: AskReference = {
  countries: [
    { code: 'IN', name: 'India' },
    { code: 'US', name: 'United States' },
  ],
  departments: [
    { id: 1, name: 'Engineering' },
    { id: 2, name: 'Sales' },
  ],
  jobTitles: [
    { id: 1, name: 'Software Engineer' },
    { id: 2, name: 'Account Executive' },
  ],
  levels: [
    { code: 'L1', name: 'Associate' },
    { code: 'L3', name: 'Senior' },
  ],
  genders: [
    { code: 'female', name: 'Female' },
    { code: 'male', name: 'Male' },
  ],
};

type Json = Record<string, unknown>;

// A small validator for the JSON Schema keywords the tool schemas use.
function accepts(schema: Json, value: unknown): boolean {
  if (Array.isArray(schema.enum)) return schema.enum.includes(value);
  if (schema.type === 'string') return typeof value === 'string';
  if (schema.type === 'array') {
    return Array.isArray(value) && value.every((item) => accepts(schema.items as Json, item));
  }
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const record = value as Json;
    const properties = schema.properties as Record<string, Json>;
    const required = schema.required as string[];
    if (!required.every((key) => key in record)) return false;
    if (schema.additionalProperties === false) {
      if (!Object.keys(record).every((key) => key in properties)) return false;
    }
    return Object.entries(properties).every(
      ([key, sub]) => !(key in record) || accepts(sub, record[key]),
    );
  }
  return false;
}

const filters = { countries: [], departments: [], jobTitles: [], levels: [], genders: [] };
const base = { metric: 'median', groupBy: 'none', filters };

const fixtures: { name: string; value: unknown }[] = [
  { name: 'empty filters', value: base },
  {
    name: 'every filter filled',
    value: {
      metric: 'genderGap',
      groupBy: 'level',
      filters: {
        countries: ['IN'],
        departments: ['Engineering'],
        jobTitles: ['Software Engineer'],
        levels: ['L3'],
        genders: [],
      },
    },
  },
  { name: 'unknown metric', value: { ...base, metric: 'mode' } },
  { name: 'unknown groupBy', value: { ...base, groupBy: 'city' } },
  { name: 'unknown country', value: { ...base, filters: { ...filters, countries: ['FR'] } } },
  { name: 'unknown job title', value: { ...base, filters: { ...filters, jobTitles: ['Wizard'] } } },
  { name: 'filter is not an array', value: { ...base, filters: { ...filters, levels: 'L3' } } },
  { name: 'missing filters key', value: { metric: 'median', groupBy: 'none' } },
  { name: 'missing one filter list', value: { ...base, filters: { countries: [] } } },
  { name: 'extra top-level key', value: { ...base, extra: 1 } },
  { name: 'extra filter key', value: { ...base, filters: { ...filters, region: [] } } },
  { name: 'missing metric', value: { groupBy: 'none', filters } },
];

describe('run_pay_query tool schema', () => {
  const { runPayQuery } = buildToolSchemas(reference);
  const zodSchema = buildStructuredQuerySchema(reference);

  it.each(fixtures)('agrees with the zod schema on: $name', ({ value }) => {
    expect(accepts(runPayQuery.input_schema, value)).toBe(zodSchema.safeParse(value).success);
  });

  it('accepts the canonical fixtures and rejects the broken ones', () => {
    const verdicts = fixtures.map((f) => accepts(runPayQuery.input_schema, f.value));

    expect(verdicts).toEqual([true, true, ...Array<boolean>(fixtures.length - 2).fill(false)]);
  });

  it('lists the reference values as enums', () => {
    const properties = (runPayQuery.input_schema.properties as Record<string, Json>).filters
      ?.properties as Record<string, Json>;

    expect((properties.countries?.items as Json).enum).toEqual(['IN', 'US']);
    expect((properties.levels?.items as Json).enum).toEqual(['L1', 'L3']);
  });
});

function hasForbiddenKeyword(schema: unknown): boolean {
  if (Array.isArray(schema)) return schema.some(hasForbiddenKeyword);
  if (typeof schema !== 'object' || schema === null) return false;
  const node = schema as Json;
  if (Array.isArray(node.type)) return true;
  if ('anyOf' in node || 'oneOf' in node || 'allOf' in node) return true;
  if (node.type === 'object') {
    const keys = Object.keys(node.properties as Json).sort();
    const required = [...(node.required as string[])].sort();
    if (JSON.stringify(keys) !== JSON.stringify(required)) return true;
    if (node.additionalProperties !== false) return true;
  }
  return Object.values(node).some(hasForbiddenKeyword);
}

describe('strict tool limits (04 section 7.2)', () => {
  const tools = buildToolSchemas(reference);

  it.each([
    ['run_pay_query', tools.runPayQuery],
    ['cannot_answer', tools.cannotAnswer],
  ])('%s has no optional or union parameters', (name, tool) => {
    expect(tool.name).toBe(name);
    expect(tool.strict).toBe(true);
    expect(hasForbiddenKeyword(tool.input_schema)).toBe(false);
  });

  it('sets no maxItems on arrays', () => {
    expect(JSON.stringify(tools.runPayQuery.input_schema)).not.toContain('maxItems');
  });
});

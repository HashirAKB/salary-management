import { describe, expect, it } from 'vitest';
import { buildStructuredQuerySchema, type AskReference } from './ask.ts';

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

const schema = buildStructuredQuerySchema(reference);

describe('StructuredQuery: enum matching (04 section 7.4)', () => {
  it('matches enum values case-insensitively and normalises them', () => {
    const parsed = schema.parse({
      metric: 'MEDIAN',
      groupBy: 'JOBTITLE',
      filters: {
        countries: ['in'],
        departments: ['engineering'],
        jobTitles: ['software engineer'],
        levels: ['l3'],
        genders: ['FEMALE'],
      },
    });

    expect(parsed).toEqual({
      metric: 'median',
      groupBy: 'jobTitle',
      filters: {
        countries: ['IN'],
        departments: ['Engineering'],
        jobTitles: ['Software Engineer'],
        levels: ['L3'],
        genders: ['female'],
      },
    });
  });

  it('rejects a value that is not in the reference list', () => {
    const result = schema.safeParse({
      metric: 'median',
      groupBy: 'none',
      filters: { countries: ['FR'], departments: [], jobTitles: [], levels: [], genders: [] },
    });

    expect(result.success).toBe(false);
  });

  it('caps each array at the size of its reference list', () => {
    const result = schema.safeParse({
      metric: 'median',
      groupBy: 'none',
      filters: {
        countries: ['IN', 'US', 'IN'],
        departments: [],
        jobTitles: [],
        levels: [],
        genders: [],
      },
    });

    expect(result.success).toBe(false);
  });
});

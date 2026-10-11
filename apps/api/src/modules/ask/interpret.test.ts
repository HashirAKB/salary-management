import type { AskReference, StructuredQuery } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { checkQuery } from './interpret.ts';

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
    { id: 10, name: 'Software Engineer' },
    { id: 20, name: 'Account Executive' },
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

const noFilters = { countries: [], departments: [], jobTitles: [], levels: [], genders: [] };
const query = (override: Partial<StructuredQuery>): StructuredQuery => ({
  metric: 'median',
  groupBy: 'none',
  filters: noFilters,
  ...override,
});

describe('checkQuery: semantic rules (04 section 7.4 step 2)', () => {
  it('refuses genderGap with a gender filter as unsupported', () => {
    const result = checkQuery(
      query({ metric: 'genderGap', filters: { ...noFilters, genders: ['female'] } }),
      reference,
    );

    expect(result).toEqual({ kind: 'cannot_answer', reason: 'unsupported', rule: 'genderGap' });
  });

  it('refuses genderGap grouped by gender as unsupported', () => {
    const result = checkQuery(query({ metric: 'genderGap', groupBy: 'gender' }), reference);

    expect(result).toEqual({ kind: 'cannot_answer', reason: 'unsupported', rule: 'genderGap' });
  });

  it('allows genderGap grouped by another dimension', () => {
    const result = checkQuery(query({ metric: 'genderGap', groupBy: 'level' }), reference);

    expect(result.kind).toBe('query');
  });

  it('allows a gender filter on other metrics', () => {
    const result = checkQuery(
      query({ metric: 'median', filters: { ...noFilters, genders: ['female'] } }),
      reference,
    );

    expect(result.kind).toBe('query');
  });
});

describe('checkQuery: names to PayFilters (04 section 7.4 step 3)', () => {
  it('resolves department and job title names to ids and keeps codes', () => {
    const result = checkQuery(
      query({
        filters: {
          countries: ['IN'],
          departments: ['Sales'],
          jobTitles: ['Software Engineer', 'Account Executive'],
          levels: ['L3'],
          genders: ['male'],
        },
      }),
      reference,
    );

    expect(result).toMatchObject({
      kind: 'query',
      filters: {
        countries: ['IN'],
        departmentIds: [2],
        jobTitleIds: [10, 20],
        levelCodes: ['L3'],
        genders: ['male'],
      },
    });
  });

  it('turns empty lists into empty filters', () => {
    const result = checkQuery(query({}), reference);

    expect(result).toMatchObject({
      kind: 'query',
      filters: { countries: [], departmentIds: [], jobTitleIds: [], levelCodes: [], genders: [] },
    });
  });
});

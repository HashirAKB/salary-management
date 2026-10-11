import type { AskReference, CannotAnswerReason, StructuredQuery } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import type { GroupResult } from '../../domain/pay-query.ts';
import {
  buildSentence,
  genderRuleSuggestion,
  interpretationList,
  reasonMessage,
} from './answer.ts';

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

const none = { countries: [], departments: [], jobTitles: [], levels: [], genders: [] };
const pinned = {
  ...none,
  countries: ['IN'],
  jobTitles: ['Software Engineer'],
  levels: ['L3'],
};

const query = (override: Partial<StructuredQuery>): StructuredQuery => ({
  metric: 'median',
  groupBy: 'none',
  filters: none,
  ...override,
});

const group = (override: Partial<GroupResult> = {}): GroupResult => ({
  key: 'all',
  label: 'All active employees',
  suppressed: false,
  headcount: 280,
  usd: { median: 2_355_200 },
  local: { median: 204_800_000 },
  outsideBand: null,
  currency: 'INR',
  gap: null,
  ...override,
});

const gapGroup = (gapPct: number | null, comparable = true) =>
  group({
    gap: comparable
      ? { comparable, women: 76, men: 195, gapPct }
      : { comparable, women: null, men: null, gapPct: null },
  });

const cases: { name: string; query: StructuredQuery; groups: GroupResult[]; sentence: string }[] = [
  {
    name: 'ungrouped money, local then USD',
    query: query({ filters: pinned }),
    groups: [group()],
    sentence:
      'Median salary for Software Engineer, L3 Senior, India: INR 20,48,000 (USD 23,552), based on 280 active employees.',
  },
  {
    name: 'mixed currencies, USD only',
    query: query({}),
    groups: [group({ currency: null, local: null })],
    sentence: 'Median salary for all active employees: USD 23,552, based on 280 active employees.',
  },
  {
    name: 'several values in one filter join with "or"',
    query: query({
      filters: { ...none, countries: ['IN', 'US'], departments: ['Sales'], genders: ['female'] },
    }),
    groups: [group({ currency: null, local: null })],
    sentence:
      'Median salary for Sales, Female, India or United States: USD 23,552, based on 280 active employees.',
  },
  {
    name: 'grouped ends with a colon',
    query: query({ groupBy: 'jobTitle', filters: { ...none, countries: ['IN'] } }),
    groups: [group(), group({ key: '2' })],
    sentence: 'Median salary by job title for India:',
  },
  {
    name: 'empty',
    query: query({ filters: { ...none, countries: ['IN'] } }),
    groups: [],
    sentence: 'No active employees match India.',
  },
  {
    name: 'suppressed',
    query: query({}),
    groups: [group({ suppressed: true, headcount: null, usd: null, local: null })],
    sentence: 'Some figures are hidden to protect groups of fewer than 5 employees.',
  },
  {
    name: 'gap, like-for-like',
    query: query({ metric: 'genderGap', filters: pinned }),
    groups: [gapGroup(8)],
    sentence:
      'Gender pay gap for Software Engineer, L3 Senior, India: women paid 8.0% less than men (like-for-like).',
  },
  {
    name: 'gap, unadjusted when grouped',
    query: query({ metric: 'genderGap', groupBy: 'level', filters: pinned }),
    groups: [gapGroup(8)],
    sentence: 'Gender pay gap by level for Software Engineer, L3 Senior, India:',
  },
  {
    name: 'gap, unadjusted',
    query: query({ metric: 'genderGap' }),
    groups: [gapGroup(8)],
    sentence:
      'Gender pay gap for all active employees: women paid 8.0% less than men (unadjusted: mixes roles and levels; see Pay equity for like-for-like cohorts).',
  },
  {
    name: 'gap, negative',
    query: query({ metric: 'genderGap', filters: pinned }),
    groups: [gapGroup(-3.2)],
    sentence:
      'Gender pay gap for Software Engineer, L3 Senior, India: women paid 3.2% more than men (like-for-like).',
  },
  {
    name: 'gap, rounds to zero',
    query: query({ metric: 'genderGap', filters: pinned }),
    groups: [gapGroup(0)],
    sentence:
      'Gender pay gap for Software Engineer, L3 Senior, India: no measurable gap (0.0%) (like-for-like).',
  },
  {
    name: 'gap, not comparable',
    query: query({ metric: 'genderGap', filters: { ...none, countries: ['IN'] } }),
    groups: [gapGroup(null, false)],
    sentence: 'Too few women or men in India to compare (at least 5 of each needed).',
  },
  {
    name: 'outside band',
    query: query({ metric: 'outsideBandCount' }),
    groups: [group({ outsideBand: { below: 12, above: 9, total: 21 } })],
    sentence:
      'Employees paid outside their band for all active employees: 21 (12 below, 9 above), based on 280 active employees.',
  },
  {
    name: 'headcount, no base',
    query: query({ metric: 'headcount', filters: { ...none, countries: ['IN'] } }),
    groups: [group()],
    sentence: 'Headcount for India: 280.',
  },
];

describe('buildSentence (04 section 7.6)', () => {
  it.each(cases)('$name', ({ query: q, groups, sentence }) => {
    expect(buildSentence(q, groups, reference)).toBe(sentence);
  });
});

describe('interpretationList', () => {
  it('lists metric, grouping and one row per non-empty filter in order', () => {
    const list = interpretationList(
      query({
        groupBy: 'jobTitle',
        filters: { ...pinned, genders: ['female', 'male'], departments: ['Sales'] },
      }),
      reference,
    );

    expect(list).toEqual([
      { label: 'Metric', value: 'Median salary' },
      { label: 'Grouped by', value: 'Job title' },
      { label: 'Country', value: 'India' },
      { label: 'Department', value: 'Sales' },
      { label: 'Job title', value: 'Software Engineer' },
      { label: 'Level', value: 'L3 Senior' },
      { label: 'Gender', value: 'Female or Male' },
    ]);
  });

  it('says Nothing when there is no grouping', () => {
    expect(interpretationList(query({}), reference)).toEqual([
      { label: 'Metric', value: 'Median salary' },
      { label: 'Grouped by', value: 'Nothing' },
    ]);
  });
});

describe('reasonMessage (04 section 7.6)', () => {
  const messages: [CannotAnswerReason, string][] = [
    [
      'individual',
      'Ask about pay answers questions about groups, not individual people. Use the employee list to look someone up.',
    ],
    ['trend', 'Ask about pay only knows current salaries, not changes over time.'],
    ['edit', "Ask about pay can't change data. Use the employee pages to make changes."],
    ['multiple', 'Ask about pay answers one figure at a time. Try asking for one.'],
    [
      'unsupported',
      'Ask about pay covers annual base salary only (no bonuses, equity, tax or net pay).',
    ],
    ['unclear', "I couldn't turn that into a pay question. Try one of the examples below."],
    ['offTopic', "I couldn't turn that into a pay question. Try one of the examples below."],
  ];

  it.each(messages)('maps %s to its message', (reason, message) => {
    expect(reasonMessage(reason)).toBe(message);
  });

  it('uses the gender-rule sentence for the gender rule', () => {
    expect(reasonMessage('unsupported', 'genderGap')).toBe(
      "The gender gap can't be filtered or grouped by gender.",
    );
  });
});

describe('genderRuleSuggestion', () => {
  it('drops the gender filter and grouping and keeps the rest as scope', () => {
    const suggestion = genderRuleSuggestion(
      query({
        metric: 'genderGap',
        groupBy: 'gender',
        filters: { ...pinned, genders: ['female'] },
      }),
      reference,
    );

    expect(suggestion).toBe('What is the gender pay gap for Software Engineer, L3 Senior, India?');
  });
});

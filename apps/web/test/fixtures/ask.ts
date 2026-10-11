import type { AskAnswerResponse, AskCannotAnswerResponse } from '@acme/shared';

export const EXAMPLES = [
  'How does total payroll split by country?',
  'How many people are paid outside their band in the US?',
  'What is the gender pay gap for Account Executives by level?',
];

export const anAnswerResponse = (
  overrides: Partial<AskAnswerResponse> = {},
): AskAnswerResponse => ({
  kind: 'answer',
  question: 'What is the median salary for senior software engineers in India?',
  answer:
    'Median salary for L3 Senior Software Engineer in India: INR 20,48,000 (USD 23,552), based on 14 active employees.',
  interpretedQuery: {
    metric: 'median',
    groupBy: 'none',
    filters: {
      countries: ['IN'],
      departments: [],
      jobTitles: ['Software Engineer'],
      levels: ['L3'],
      genders: [],
    },
  },
  interpretation: [
    { label: 'Metric', value: 'Median salary' },
    { label: 'Grouped by', value: 'Nothing' },
    { label: 'Country', value: 'India' },
    { label: 'Job title', value: 'Software Engineer' },
    { label: 'Level', value: 'L3 Senior' },
  ],
  result: {
    groupBy: 'none',
    rows: [
      {
        key: 'all',
        label: 'All matching employees',
        headcount: 14,
        suppressed: false,
        value: {
          type: 'money',
          usd: { amountMinor: 2355200, currency: 'USD' },
          local: { amountMinor: 204800000, currency: 'INR' },
        },
      },
    ],
  },
  fxAsOf: '2026-09-30',
  usage: { usedToday: 3, dailyLimit: 30 },
  ...overrides,
});

export const aCannotAnswerResponse = (
  overrides: Partial<AskCannotAnswerResponse> = {},
): AskCannotAnswerResponse => ({
  kind: 'cannot_answer',
  question: 'How much does Priya earn?',
  reason: 'individual',
  message:
    'Ask about pay answers questions about groups, not individual people. Use the employee list to look someone up.',
  suggestion: 'What is the average salary for Software Engineers?',
  examples: EXAMPLES,
  usage: { usedToday: 1, dailyLimit: 30 },
  ...overrides,
});

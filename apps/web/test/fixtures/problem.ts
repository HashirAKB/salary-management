import { problemSchema, type Problem } from '@acme/shared';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
};

// Fixture builders parse with the shared response schema (D-050).
export const aProblem = (overrides: Partial<Problem> & Pick<Problem, 'status' | 'code'>): Problem =>
  problemSchema.parse({
    type: 'about:blank',
    title: TITLES[overrides.status] ?? 'Error',
    detail: 'Something was wrong with the request.',
    ...overrides,
  });

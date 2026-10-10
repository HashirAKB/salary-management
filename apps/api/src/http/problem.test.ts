import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { problem, validationErrors } from './problem.ts';

describe('problem', () => {
  it.each([
    [400, 'Bad Request'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [404, 'Not Found'],
    [415, 'Unsupported Media Type'],
    [422, 'Unprocessable Content'],
    [429, 'Too Many Requests'],
    [500, 'Internal Server Error'],
    [503, 'Service Unavailable'],
  ])('sets type about:blank and the status phrase as title for %i', (status, title) => {
    const body = problem({
      status,
      code: 'SOME_CODE',
      detail: 'A sentence for the user.',
      instance: '/api/thing',
    });

    expect(body).toEqual({
      type: 'about:blank',
      title,
      status,
      code: 'SOME_CODE',
      detail: 'A sentence for the user.',
      instance: '/api/thing',
    });
  });
});

describe('validationErrors', () => {
  it('turns zod errors into errors[] with dot-joined paths', () => {
    const schema = z.object({
      firstName: z.string().min(1, 'First name is required.'),
      startingSalary: z.object({
        amountMinor: z.number().int().positive('Must be a whole number greater than 0.'),
      }),
      tags: z.array(z.string('Must be text.')),
    });
    const result = schema.safeParse({
      firstName: '',
      startingSalary: { amountMinor: -5 },
      tags: ['ok', 7],
    });
    if (result.success) throw new Error('expected the parse to fail');

    expect(validationErrors(result.error)).toEqual([
      { path: 'firstName', message: 'First name is required.' },
      { path: 'startingSalary.amountMinor', message: 'Must be a whole number greater than 0.' },
      { path: 'tags.1', message: 'Must be text.' },
    ]);
  });
});

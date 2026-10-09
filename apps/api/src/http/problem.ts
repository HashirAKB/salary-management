import type { z } from 'zod';

export type ProblemFieldError = { path: string; message: string };

// RFC 9457 problem details (04 section 4.4).
export type Problem = {
  type: 'about:blank';
  title: string;
  status: number;
  detail: string;
  code: string;
  instance?: string;
  errors?: ProblemFieldError[];
};

export type ProblemInput = Omit<Problem, 'type' | 'title'>;

export function problem(_input: ProblemInput): Problem {
  throw new Error('not implemented');
}

export function validationErrors(_error: z.ZodError): ProblemFieldError[] {
  throw new Error('not implemented');
}

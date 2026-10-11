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

// Thrown below the route layer; the error handler turns it into a problem response.
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: ProblemFieldError[] | undefined;
  /** Extra response headers, such as Retry-After on a 429. */
  readonly headers: Record<string, string> | undefined;

  constructor(
    status: number,
    code: string,
    detail: string,
    errors?: ProblemFieldError[],
    headers?: Record<string, string>,
  ) {
    super(detail);
    this.errors = errors;
    this.headers = headers;
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

// RFC 9110 status phrases for every status in the 04 section 4.4 catalogue.
const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export function problem(input: ProblemInput): Problem {
  return { type: 'about:blank', title: STATUS_TITLES[input.status] ?? 'Error', ...input };
}

export function validationErrors(error: z.ZodError): ProblemFieldError[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

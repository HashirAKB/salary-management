import type { ErrorCode, Problem } from '@acme/shared';

/** A problem response (04 section 4.4) as the screens see it. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly errors: NonNullable<Problem['errors']>;
  /** Seconds from a 429's Retry-After header. */
  readonly retryAfter: number | undefined;

  constructor(problem: Problem, retryAfter?: number) {
    super(problem.detail);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.errors = problem.errors ?? [];
    this.retryAfter = retryAfter;
  }
}

export type ApiRequest<T> = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Parses a 2xx JSON body; omit for 204 responses. */
  schema?: { parse(value: unknown): T };
};

/** Calls the same-origin API (ADR 0002). Throws ApiError for a problem response. */
export async function apiFetch<T = void>(_path: string, _request: ApiRequest<T> = {}): Promise<T> {
  throw new Error('not implemented');
}

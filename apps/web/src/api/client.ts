import { problemSchema, type ErrorCode, type Problem } from '@acme/shared';

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

const unauthenticatedListeners = new Set<() => void>();

/** Runs `listener` whenever a call gets 401 UNAUTHENTICATED; returns the unsubscribe. */
export function onUnauthenticated(listener: () => void): () => void {
  unauthenticatedListeners.add(listener);
  return () => unauthenticatedListeners.delete(listener);
}

/** Calls the same-origin API (ADR 0002). Throws ApiError for a problem response. */
export async function apiFetch<T = void>(
  path: string,
  { method = 'GET', body, schema }: ApiRequest<T> = {},
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    const error = new ApiError(
      problemSchema.parse(await response.json()),
      retryAfter ? Number(retryAfter) : undefined,
    );
    if (error.code === 'UNAUTHENTICATED')
      unauthenticatedListeners.forEach((listener) => listener());
    throw error;
  }
  return (schema ? schema.parse(await response.json()) : undefined) as T;
}

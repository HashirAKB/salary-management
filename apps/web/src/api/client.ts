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

/** Reads a problem+json response (04 section 4.4) into an ApiError. */
async function toApiError(response: Response): Promise<ApiError> {
  const retryAfter = response.headers.get('retry-after');
  return new ApiError(
    problemSchema.parse(await response.json()),
    retryAfter ? Number(retryAfter) : undefined,
  );
}

const unauthenticatedListeners = new Set<() => void>();

/** Runs `listener` whenever a call gets 401 UNAUTHENTICATED; returns the unsubscribe. */
export function onUnauthenticated(listener: () => void): () => void {
  unauthenticatedListeners.add(listener);
  return () => unauthenticatedListeners.delete(listener);
}

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await toApiError(response);
    if (error.code === 'UNAUTHENTICATED')
      unauthenticatedListeners.forEach((listener) => listener());
    throw error;
  }
  return response;
}

/** Calls the same-origin API (ADR 0002). Throws ApiError for a problem response. */
export async function apiFetch<T = void>(
  path: string,
  { method = 'GET', body, schema }: ApiRequest<T> = {},
): Promise<T> {
  const response = await send(path, method, body);
  return (schema ? schema.parse(await response.json()) : undefined) as T;
}

/** Fetches a file; the name comes from Content-Disposition. Throws ApiError for a problem response. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await send(path, 'GET');
  const disposition = response.headers.get('content-disposition') ?? '';
  return {
    blob: await response.blob(),
    filename: /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'download',
  };
}

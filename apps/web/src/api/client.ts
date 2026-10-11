import { problemSchema, type ErrorCode, type Problem } from '@acme/shared';
import { connection } from './connection.ts';

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

/** The server is asleep or unreachable (D-045); the connection store polls until it wakes. */
export class ServerWakingError extends Error {
  constructor(write = false) {
    super(
      write
        ? 'The server was waking up, so your change may not have been saved. Check the page and try again.'
        : 'The server is waking up.',
    );
    this.name = 'ServerWakingError';
  }
}

const SLEEPING_STATUSES = [502, 503, 504];
const isJson = (response: Response) =>
  (response.headers.get('content-type') ?? '').includes('json');
/** A problem response: problem+json, or JSON that has a problem body (D-045). */
async function hasProblemBody(response: Response): Promise<boolean> {
  if ((response.headers.get('content-type') ?? '').includes('application/problem+json'))
    return true;
  if (!isJson(response)) return false;
  return problemSchema.safeParse(
    await response
      .clone()
      .json()
      .catch(() => undefined),
  ).success;
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

async function sendOnce(
  path: string,
  method: string,
  body?: unknown,
  expectJson = false,
): Promise<Response> {
  const finish = connection.requestStarted();
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      if (
        !(await hasProblemBody(response)) &&
        (SLEEPING_STATUSES.includes(response.status) || !isJson(response))
      )
        throw new ServerWakingError(method !== 'GET');
      const error = await toApiError(response);
      if (error.code === 'UNAUTHENTICATED')
        unauthenticatedListeners.forEach((listener) => listener());
      throw error;
    }
    if (expectJson && !isJson(response)) throw new ServerWakingError(method !== 'GET');
    return response;
  } catch (error) {
    if (error instanceof TypeError) {
      connection.serverWaking();
      throw new ServerWakingError(method !== 'GET');
    }
    if (error instanceof ServerWakingError) connection.serverWaking();
    throw error;
  } finally {
    finish();
  }
}

/** Retries a GET once after the server wakes; a write is never retried (D-045). */
async function send(
  path: string,
  method: string,
  body?: unknown,
  expectJson = false,
): Promise<Response> {
  try {
    return await sendOnce(path, method, body, expectJson);
  } catch (error) {
    if (method !== 'GET' || !(error instanceof ServerWakingError)) throw error;
    if (!(await connection.recovered())) throw error;
    return sendOnce(path, method, body, expectJson);
  }
}

/** Calls the same-origin API (ADR 0002). Throws ApiError for a problem response. */
export async function apiFetch<T = void>(
  path: string,
  { method = 'GET', body, schema }: ApiRequest<T> = {},
): Promise<T> {
  const response = await send(path, method, body, schema !== undefined);
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

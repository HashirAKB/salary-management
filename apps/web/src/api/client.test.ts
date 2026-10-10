import { healthResponseSchema } from '@acme/shared';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { aHealthResponse } from '../../test/fixtures/health.ts';
import { aProblem } from '../../test/fixtures/problem.ts';
import { server } from '../../test/server.ts';
import { ApiError, apiFetch } from './client.ts';

const problemJson = (body: object, init: { status: number; headers?: Record<string, string> }) =>
  HttpResponse.json(body, {
    status: init.status,
    headers: { 'content-type': 'application/problem+json', ...init.headers },
  });

describe('apiFetch (05 section 5.9)', () => {
  it('the API client turns a problem response into an ApiError with its code', async () => {
    server.use(
      http.post('/api/employees/7/salary-changes', () =>
        problemJson(
          aProblem({
            status: 422,
            code: 'SALARY_DATE_BEFORE_CURRENT',
            detail: 'The effective date must be on or after 2026-04-01.',
          }),
          { status: 422 },
        ),
      ),
    );

    const error = await apiFetch('/api/employees/7/salary-changes', {
      method: 'POST',
      body: {},
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'SALARY_DATE_BEFORE_CURRENT',
      message: 'The effective date must be on or after 2026-04-01.',
    });
  });

  it('reads the Retry-After seconds of a 429 into the ApiError', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        problemJson(aProblem({ status: 429, code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'retry-after': '42' },
        }),
      ),
    );

    const error = await apiFetch('/api/auth/login', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 42 });
  });

  it('sends JSON and returns the body parsed with the given schema', async () => {
    let sent: { contentType: string | null; body: unknown } | undefined;
    server.use(
      http.post('/api/__test/echo', async ({ request }) => {
        sent = { contentType: request.headers.get('content-type'), body: await request.json() };
        return HttpResponse.json(aHealthResponse());
      }),
    );

    const result = await apiFetch('/api/__test/echo', {
      method: 'POST',
      body: { a: 1 },
      schema: healthResponseSchema,
    });

    expect(result).toEqual({ status: 'ok' });
    expect(sent).toEqual({ contentType: 'application/json', body: { a: 1 } });
  });
});

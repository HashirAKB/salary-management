import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aProblem } from '../../test/fixtures/problem.ts';
import { aManualScheduler } from '../../test/manualScheduler.ts';
import { render } from '../../test/render.tsx';
import { server } from '../../test/server.ts';
import { apiFetch } from '../api/client.ts';
import { connection } from '../api/connection.ts';
import { ServerStatusBanner } from './ServerStatusBanner.tsx';

const WAKING = /^Waking the server\./;

let scheduler: ReturnType<typeof aManualScheduler>;
beforeEach(() => {
  scheduler = aManualScheduler();
  connection.setScheduler(scheduler);
});
afterEach(() => connection.reset());

describe('waking banner (05 section 5.9 C rows 2 and 3; D-045)', () => {
  it('shows the waking banner when a request is pending over 4 seconds', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get('/api/slow', async () => {
        await gate;
        return HttpResponse.json({ status: 'ok' });
      }),
    );
    render(<ServerStatusBanner />);

    const pending = apiFetch('/api/slow');
    act(() => scheduler.advance(3999));
    expect(screen.queryByText(WAKING)).toBeNull();
    act(() => scheduler.advance(1));

    expect(await screen.findByText(WAKING)).toBeVisible();
    release();
    await pending;
  });

  it.each([
    [
      'a 200 HTML page',
      () => new HttpResponse('<html></html>', { headers: { 'content-type': 'text/html' } }),
    ],
    ['a bare 502', () => new HttpResponse('Bad Gateway', { status: 502 })],
    ['a bare 503', () => new HttpResponse(null, { status: 503 })],
    ['a bare 504', () => new HttpResponse(null, { status: 504 })],
    ['a network error', () => HttpResponse.error()],
  ])('shows the waking banner for %s', async (_name, respond) => {
    server.use(http.get('/api/employees', respond));
    render(<ServerStatusBanner />);

    await apiFetch('/api/employees', { schema: { parse: (v) => v } }).catch(() => {});

    expect(await screen.findByText(WAKING)).toBeVisible();
  });

  it('treats a 503 with a problem body as an ApiError and shows no banner', async () => {
    server.use(
      http.get('/api/health', () =>
        HttpResponse.json(aProblem({ status: 503, code: 'DB_UNAVAILABLE' }), {
          status: 503,
          headers: { 'content-type': 'application/problem+json' },
        }),
      ),
    );
    render(<ServerStatusBanner />);

    const error = await apiFetch('/api/health').catch((e: unknown) => e);

    expect(error).toMatchObject({ name: 'ApiError', code: 'DB_UNAVAILABLE' });
    expect(screen.queryByText(WAKING)).toBeNull();
  });
});

describe('health poll and GET retry (05 section 5.9 C row 3; D-045)', () => {
  it('hides the banner when health answers 200 and retries the failed GET once', async () => {
    let gets = 0;
    let polls = 0;
    server.use(
      http.get('/api/employees', () => {
        gets += 1;
        return gets === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ ok: 1 });
      }),
      http.get('/api/health', () => {
        polls += 1;
        return polls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ status: 'ok' });
      }),
    );
    render(<ServerStatusBanner />);

    const result = apiFetch('/api/employees', { schema: { parse: (v) => v } });
    expect(await screen.findByText(WAKING)).toBeVisible();
    act(() => scheduler.advance(3000));
    await waitFor(() => expect(polls).toBe(1));
    expect(screen.getByText(WAKING)).toBeVisible();
    act(() => scheduler.advance(3000));

    await expect(result).resolves.toEqual({ ok: 1 });
    expect(polls).toBe(2);
    expect(gets).toBe(2);
    await waitFor(() => expect(screen.queryByText(WAKING)).toBeNull());
  });
});

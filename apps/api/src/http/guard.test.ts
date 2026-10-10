import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loggedInAs } from '../../test/builders/index.ts';
import { testApp, testDb } from '../../test/helpers.ts';
import type { Db } from '../db/client.ts';
import { requires } from './guard.ts';

// Test-only routes: S2 has no production route that needs an action yet (04 section 4.3).
function withTestRoutes(app: FastifyInstance) {
  app.get('/api/__test/read', { onRequest: requires('employee.read') }, async () => ({ ok: true }));
  app.post(
    '/api/__test/write',
    {
      onRequest: requires('employee.write'),
      schema: { body: z.object({ firstName: z.string().min(1) }) },
    },
    async () => ({ ok: true }),
  );
  app.get('/api/__test/public', { onRequest: requires('public') }, async () => ({ ok: true }));
  app.get('/api/__test/session', { onRequest: requires('authenticated') }, async () => ({
    ok: true,
  }));
  return app;
}

describe('requires(action) guard (D-043)', () => {
  let app: FastifyInstance | undefined;
  let db: Db;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('a guarded route returns 401 UNAUTHENTICATED when logged out', async () => {
    app = withTestRoutes(testApp());

    const response = await app.inject({ method: 'GET', url: '/api/__test/read' });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      instance: '/api/__test/read',
    });
  });

  it('a guarded route returns 403 FORBIDDEN when the role lacks the action', async () => {
    db = await testDb();
    const finance = await loggedInAs(db, 'finance');
    const viewer = await loggedInAs(db, 'hr_viewer');
    app = withTestRoutes(testApp({ db }));

    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/__test/read',
      headers: { cookie: finance.cookie },
    });
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/__test/read',
      headers: { cookie: viewer.cookie },
    });

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ title: 'Forbidden', status: 403, code: 'FORBIDDEN' });
    expect(allowed.statusCode).toBe(200);
  });

  it('a Finance user sending an invalid body to a write route gets 403, not 400', async () => {
    db = await testDb();
    const finance = await loggedInAs(db, 'finance');
    const admin = await loggedInAs(db, 'hr_admin');
    app = withTestRoutes(testApp({ db }));
    const invalid = { firstName: '', unknown: 1 };

    const asFinance = await app.inject({
      method: 'POST',
      url: '/api/__test/write',
      headers: { cookie: finance.cookie },
      payload: invalid,
    });
    const asAdmin = await app.inject({
      method: 'POST',
      url: '/api/__test/write',
      headers: { cookie: admin.cookie },
      payload: invalid,
    });

    expect(asFinance.statusCode).toBe(403);
    expect(asFinance.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(asAdmin.statusCode).toBe(400);
    expect(asAdmin.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ path: 'firstName' })],
    });
  });

  it("'public' always passes, and 'authenticated' needs a session but no action", async () => {
    db = await testDb();
    const finance = await loggedInAs(db, 'finance');
    app = withTestRoutes(testApp({ db }));

    const publicLoggedOut = await app.inject({ method: 'GET', url: '/api/__test/public' });
    const sessionLoggedOut = await app.inject({ method: 'GET', url: '/api/__test/session' });
    const sessionAsFinance = await app.inject({
      method: 'GET',
      url: '/api/__test/session',
      headers: { cookie: finance.cookie },
    });

    expect(publicLoggedOut.statusCode).toBe(200);
    expect(sessionLoggedOut.statusCode).toBe(401);
    expect(sessionAsFinance.statusCode).toBe(200);
  });
});

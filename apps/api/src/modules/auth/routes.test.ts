import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { aUser, loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testConfig, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';
import { fixedClock } from '../../domain/clock.ts';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function sidFrom(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = /^sid=([^;]+)/.exec(header ?? '');
  if (!match?.[1]) throw new Error(`no sid cookie in ${String(header)}`);
  return match[1];
}

describe('POST /api/auth/login (A2)', () => {
  let app: FastifyInstance | undefined;
  let db: Db;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function login(email: string, password: string) {
    return app!.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
  }

  it('logging in with correct details returns the me body and sets an HttpOnly, SameSite=Lax cookie', async () => {
    db = await testDb();
    const user = await aUser('hr_viewer').withEmail('viewer@test.local').insert(db);
    app = testApp({ db });

    const response = await login('viewer@test.local', user.password);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: user.id,
        email: 'viewer@test.local',
        displayName: 'HR Viewer (test)',
        role: 'hr_viewer',
      },
      permissions: [
        'reference.read',
        'employee.read',
        'salary.read',
        'export.employees',
        'insights.read',
        'ask.use',
      ],
      askEnabled: false,
      today: '2026-10-09',
      fxAsOf: '2026-09-30',
    });
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/^sid=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('; HttpOnly');
    expect(cookie).toContain('; SameSite=Lax');
    expect(cookie).toContain('; Path=/');
    expect(cookie).toContain('; Max-Age=28800');
    expect(cookie).not.toContain('Secure');
  });

  it.each([
    ['password', { email: 'viewer@test.local' }],
    ['email', { email: 'not-an-email', password: 'test-password-123' }],
  ])('returns 400 VALIDATION_FAILED for a malformed login body (%s)', async (path, payload) => {
    app = testApp();

    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ path })],
    });
  });

  it('matches the email after trimming and lower-casing it', async () => {
    db = await testDb();
    const user = await aUser('finance').withEmail('finance@test.local').insert(db);
    app = testApp({ db });

    const response = await login('  Finance@Test.Local ', user.password);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { id: user.id, role: 'finance' } });
  });

  it('the cookie is Secure when NODE_ENV is production', async () => {
    db = await testDb();
    const user = await aUser('hr_admin').insert(db);
    app = testApp({ db, config: { ...testConfig, nodeEnv: 'production' } });

    const response = await login(user.email, user.password);

    expect(response.statusCode).toBe(200);
    expect(String(response.headers['set-cookie'])).toContain('; Secure');
  });

  it("the session table stores the token's hash, not the token", async () => {
    db = await testDb();
    const user = await aUser('hr_admin').insert(db);
    app = testApp({ db });

    const response = await login(user.email, user.password);
    expect(response.statusCode).toBe(200);
    const token = sidFrom(response.headers['set-cookie']);
    const rows = await db.all<{
      token_hash: string;
      user_id: number;
      created_at: string;
      expires_at: string;
    }>('SELECT token_hash, user_id, created_at, expires_at FROM sessions');

    expect(rows).toEqual([
      {
        token_hash: sha256(token),
        user_id: user.id,
        created_at: '2026-10-09T09:00:00.000Z',
        expires_at: '2026-10-09T17:00:00.000Z',
      },
    ]);
    expect(rows[0]?.token_hash).not.toContain(token);
  });

  it('a wrong password and an unknown email return the same 401 body', async () => {
    db = await testDb();
    const user = await aUser('hr_admin').insert(db);
    app = testApp({ db });

    const wrongPassword = await login(user.email, 'not-the-password');
    const unknownEmail = await login('nobody@test.local', user.password);

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(wrongPassword.json()).toEqual({
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      detail: 'Email or password is incorrect.',
      code: 'INVALID_CREDENTIALS',
      instance: '/api/auth/login',
    });
    expect(unknownEmail.json()).toEqual(wrongPassword.json());
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    expect(await db.all('SELECT * FROM sessions')).toEqual([]);
  });

  describe('rate limit', () => {
    const attemptFrom = (ip: string) =>
      app!.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'x-forwarded-for': ip },
        payload: { email: 'nobody@test.local', password: 'wrong-password' },
      });

    it('the 11th login attempt in a minute from one IP returns 429 with Retry-After', async () => {
      app = testApp();

      for (let i = 0; i < 10; i++) {
        expect((await attemptFrom('203.0.113.7')).statusCode).toBe(401);
      }
      const response = await attemptFrom('203.0.113.7');

      expect(response.statusCode).toBe(429);
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.json()).toMatchObject({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'RATE_LIMITED',
        instance: '/api/auth/login',
      });
      const retryAfter = Number(response.headers['retry-after']);
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('ignores X-Forwarded-For entries the client added before the proxy', async () => {
      app = testApp();

      // Render appends the real client address; anything to its left came from the client.
      for (let i = 0; i < 10; i++) await attemptFrom(`10.0.0.${i}, 203.0.113.7`);
      const response = await attemptFrom('10.0.0.99, 203.0.113.7');

      expect(response.statusCode).toBe(429);
    });

    it('counts login attempts per client IP taken from X-Forwarded-For', async () => {
      app = testApp();

      for (let i = 0; i < 11; i++) await attemptFrom('203.0.113.7');
      const otherClient = await attemptFrom('198.51.100.9');

      expect(otherClient.statusCode).toBe(401);
    });
  });
});

describe('GET /api/auth/me (A4)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const me = (cookie?: string) =>
    app!.inject({ method: 'GET', url: '/api/auth/me', headers: cookie ? { cookie } : {} });

  it("me returns the role's permissions, today from the clock, and askEnabled false without an API key", async () => {
    const db = await testDb();
    const { cookie, user } = await loggedInAs(db, 'finance');
    app = testApp({ db });

    const response = await me(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: user.id, email: user.email, displayName: 'Finance (test)', role: 'finance' },
      permissions: ['reference.read', 'insights.read', 'ask.use'],
      askEnabled: false,
      today: '2026-10-09',
      fxAsOf: '2026-09-30',
    });
  });

  it('me returns askEnabled true when an API key is set', async () => {
    const db = await testDb();
    const { cookie } = await loggedInAs(db, 'hr_viewer');
    app = testApp({ db, config: { ...testConfig, anthropicApiKey: 'sk-test' } });

    const response = await me(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ askEnabled: true });
  });

  it('me without a session returns 401 UNAUTHENTICATED', async () => {
    app = testApp();

    const response = await me();

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      title: 'Unauthorized',
      status: 401,
      code: 'UNAUTHENTICATED',
      instance: '/api/auth/me',
    });
  });
});

describe('session expiry and POST /api/auth/logout (A3)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const me = (cookie: string) =>
    app!.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });

  it('a session older than 8 hours returns 401', async () => {
    const db = await testDb();
    const { cookie } = await loggedInAs(db, 'hr_admin');
    const clock = fixedClock('2026-10-09T09:00:00.000Z');
    app = testApp({ db, clock });

    clock.advance(8 * 60 * 60 * 1000 - 1);
    const lastMoment = await me(cookie);
    clock.advance(1);
    const expired = await me(cookie);

    expect(lastMoment.statusCode).toBe(200);
    expect(expired.statusCode).toBe(401);
    expect(expired.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('logout deletes the session, and the old cookie then returns 401', async () => {
    const db = await testDb();
    const { cookie } = await loggedInAs(db, 'hr_viewer');
    app = testApp({ db });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
      payload: {},
    });

    expect(response.statusCode).toBe(204);
    expect(String(response.headers['set-cookie'])).toMatch(/^sid=; .*Max-Age=0/);
    expect(await db.all('SELECT * FROM sessions')).toEqual([]);
    expect((await me(cookie)).statusCode).toBe(401);
  });

  it('logout without a session returns 204', async () => {
    app = testApp();

    const response = await app.inject({ method: 'POST', url: '/api/auth/logout' });

    expect(response.statusCode).toBe(204);
  });
});

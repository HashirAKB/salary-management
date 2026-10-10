import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { aUser } from '../../../test/builders/index.ts';
import { testApp, testConfig, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';

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
});

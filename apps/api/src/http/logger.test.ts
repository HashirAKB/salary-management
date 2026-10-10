import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { loggedInAs } from '../../test/builders/index.ts';
import { testApp, testConfig, testDb } from '../../test/helpers.ts';

describe('logging and caching (05 section 5.0)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('authenticated responses carry Cache-Control: no-store', async () => {
    const db = await testDb();
    const { cookie } = await loggedInAs(db, 'hr_viewer');
    app = testApp({ db });

    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('logs redact the cookie header, password and any *Minor field', async () => {
    const lines: string[] = [];
    app = testApp({
      config: { ...testConfig, logLevel: 'info' },
      logStream: { write: (line) => void lines.push(line) },
    });
    app.post('/api/__test/log', async (request) => {
      request.log.info({ headers: request.headers, body: request.body }, 'echo');
      return {};
    });

    await app.inject({
      method: 'POST',
      url: '/api/__test/log',
      headers: { cookie: 'sid=secret-session-token' },
      payload: {
        email: 'hr.admin@acme.test',
        password: 'hunter2-secret',
        salary: { amountMinor: 4242424, currency: 'INR' },
        nested: [{ midMinor: 7373737 }],
      },
    });
    const output = lines.join('');
    const echo = lines.map((line) => JSON.parse(line)).find((entry) => entry.msg === 'echo');

    expect(echo).toBeDefined();
    expect(echo.body.email).toBe('hr.admin@acme.test');
    expect(echo.body.salary.currency).toBe('INR');
    expect(echo.headers.cookie).toBe('[Redacted]');
    expect(echo.body.password).toBe('[Redacted]');
    expect(echo.body.salary.amountMinor).toBe('[Redacted]');
    expect(echo.body.nested[0].midMinor).toBe('[Redacted]');
    expect(output).not.toContain('secret-session-token');
    expect(output).not.toContain('hunter2-secret');
    expect(output).not.toContain('4242424');
    expect(output).not.toContain('7373737');
  });
});

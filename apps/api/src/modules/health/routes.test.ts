import { healthResponseSchema } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../../../test/helpers.ts';
import { createDb } from '../../db/client.ts';

describe('GET /api/health', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns 200 with { status: "ok" } when the database answers', async () => {
    app = testApp();

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ status: 'ok' });
  });

  it("returns 503 DB_UNAVAILABLE when the database can't answer", async () => {
    const db = createDb(':memory:');
    db.$client.close();
    app = testApp({ db });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      title: 'Service Unavailable',
      status: 503,
      code: 'DB_UNAVAILABLE',
    });
  });
});

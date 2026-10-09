import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from '../../test/helpers.ts';

describe('error handling', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('an unknown /api path returns a 404 problem with code ROUTE_NOT_FOUND', async () => {
    app = testApp();

    const response = await app.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      instance: '/api/nope',
    });
  });

  it('a write with a non-JSON body returns 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    app = testApp();
    app.post('/api/__test/echo', async (request) => request.body);

    const response = await app.inject({
      method: 'POST',
      url: '/api/__test/echo',
      headers: { 'content-type': 'text/plain' },
      payload: 'hello',
    });

    expect(response.statusCode).toBe(415);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({
      title: 'Unsupported Media Type',
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('an unexpected error returns 500 INTERNAL with no stack trace in the body', async () => {
    app = testApp();
    app.get('/api/__test/boom', async () => {
      throw new Error('kaboom from a secret place');
    });

    const response = await app.inject({ method: 'GET', url: '/api/__test/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    const body = response.json();
    expect(body).toMatchObject({ title: 'Internal Server Error', status: 500, code: 'INTERNAL' });
    expect(body).not.toHaveProperty('stack');
    expect(response.body).not.toContain('kaboom');
  });
});

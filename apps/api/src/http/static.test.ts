import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { testApp } from '../../test/helpers.ts';

const MARKER = '<title>ACME test build</title>';

describe('static serving of the web build', () => {
  let staticRoot: string;
  let app: FastifyInstance | undefined;

  beforeAll(() => {
    staticRoot = mkdtempSync(join(tmpdir(), 'acme-web-dist-'));
    writeFileSync(
      join(staticRoot, 'index.html'),
      `<!doctype html><html><head>${MARKER}</head></html>`,
    );
  });

  afterAll(() => {
    rmSync(staticRoot, { recursive: true, force: true });
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('a non-API path returns index.html when static serving is on', async () => {
    app = testApp({ staticRoot });

    const response = await app.inject({ method: 'GET', url: '/employees/42' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.body).toContain(MARKER);
  });

  it('an unknown /api path is still a ROUTE_NOT_FOUND problem when static serving is on', async () => {
    app = testApp({ staticRoot });

    const response = await app.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toMatchObject({ code: 'ROUTE_NOT_FOUND' });
    expect(response.body).not.toContain(MARKER);
  });
});

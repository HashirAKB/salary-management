import { employeeListResponseSchema } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';

// Cells of the first column, header row dropped.
const firstColumn = (csv: string) =>
  csv
    .replace('﻿', '')
    .split('\r\n')
    .filter((line) => line !== '')
    .slice(1)
    .map((line) => /^"((?:[^"]|"")*)"/.exec(line)?.[1]);

describe('GET /api/exports/employees.csv (X1)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(seed: (db: Db) => Promise<void> = async () => {}) {
    const db = await testDb();
    await seed(db);
    app = testApp({ db });
    const as = async (role: 'hr_admin' | 'hr_viewer' | 'finance') => {
      const { cookie } = await loggedInAs(db, role);
      return (path: string) => app!.inject({ method: 'GET', url: path, headers: { cookie } });
    };
    return { as };
  }

  it('returns the same employees in the same order as the list for the same filters', async () => {
    const { as } = await setup(async (db) => {
      for (let i = 0; i < 60; i++) {
        await anEmployee()
          .named('Asha', `Surname${String(i).padStart(3, '0')}`)
          .inCountry(i % 2 === 0 ? 'IN' : 'US')
          .withSalary(1_000_000 + (i % 7) * 1000)
          .insert(db);
      }
      await anEmployee().named('Zed', 'Gone').terminatedOn('2025-01-31').insert(db);
    });
    const get = await as('hr_viewer');
    const query = '?country=IN,US&status=all&sort=salaryUsd&order=desc';

    const list = employeeListResponseSchema.parse(
      (await get(`/api/employees${query}&pageSize=100`)).json(),
    );
    const exported = await get(`/api/exports/employees.csv${query}`);

    expect(exported.statusCode).toBe(200);
    expect(list.items).toHaveLength(61);
    expect(firstColumn(exported.body)).toEqual(list.items.map((item) => item.employeeCode));
  });

  it('exports every matching row, not one page of them', async () => {
    const { as } = await setup(async (db) => {
      for (let i = 0; i < 60; i++) await anEmployee().insert(db);
    });
    const get = await as('hr_admin');

    const exported = await get('/api/exports/employees.csv');

    expect(firstColumn(exported.body)).toHaveLength(60);
  });

  it('rejects page, pageSize and unknown params with 400 VALIDATION_FAILED', async () => {
    const { as } = await setup();
    const get = await as('hr_admin');

    for (const query of ['?page=2', '?pageSize=25', '?nope=1']) {
      const response = await get(`/api/exports/employees.csv${query}`);
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    }
  });

  it('sets the filename from the clock, text/csv and no-store', async () => {
    const { as } = await setup();
    const get = await as('hr_admin');

    const response = await get('/api/exports/employees.csv');

    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="employees-2026-10-09.csv"',
    );
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('lets HR Viewer export, refuses Finance with 403 and anonymous with 401', async () => {
    const { as } = await setup();

    expect((await (await as('hr_viewer'))('/api/exports/employees.csv')).statusCode).toBe(200);
    expect((await (await as('finance'))('/api/exports/employees.csv')).statusCode).toBe(403);
    const anonymous = await app!.inject({ method: 'GET', url: '/api/exports/employees.csv' });
    expect(anonymous.statusCode).toBe(401);
  });
});

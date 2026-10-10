import { compaRatio, employeeListResponseSchema, toUsdMinor } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';
import { generateBands, SOFTWARE_ENGINEER } from '../../seed/reference.ts';

describe('GET /api/employees (E1)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(seed: (db: Db) => Promise<void>) {
    const db = await testDb();
    await seed(db);
    const { cookie } = await loggedInAs(db, 'hr_viewer');
    app = testApp({ db });
    return (query = '') =>
      app!.inject({ method: 'GET', url: `/api/employees${query}`, headers: { cookie } });
  }

  async function insertMany(db: Db, count: number) {
    for (let i = 0; i < count; i++) {
      await anEmployee()
        .named('Asha', `Surname${String(i).padStart(3, '0')}`)
        .insert(db);
    }
  }

  it('returns active employees sorted by last name, 50 per page, with total and totalPages', async () => {
    const get = await setup(async (db) => {
      await insertMany(db, 120);
      await anEmployee().named('Zed', 'Aaa').terminatedOn('2025-01-31').insert(db);
    });

    const response = await get();

    expect(response.statusCode).toBe(200);
    const body = employeeListResponseSchema.parse(response.json());
    expect(body).toMatchObject({ page: 1, pageSize: 50, total: 120, totalPages: 3 });
    expect(body.items).toHaveLength(50);
    const lastNames = body.items.map((item) => item.lastName);
    expect(lastNames[0]).toBe('Surname000');
    expect(lastNames).toEqual([...lastNames].sort());
    expect(body.items.every((item) => item.status === 'active')).toBe(true);
    expect(body.fxAsOf).toBe('2026-09-30');
  });

  it('breaks ties on first name and then id', async () => {
    const get = await setup(async (db) => {
      await anEmployee().named('Bea', 'Same').insert(db);
      await anEmployee().named('Abe', 'Same').insert(db);
      await anEmployee().named('Abe', 'Same').insert(db);
    });

    const body = employeeListResponseSchema.parse((await get()).json());

    expect(body.items.map((item) => [item.firstName, item.id])).toEqual([
      ['Abe', 2],
      ['Abe', 3],
      ['Bea', 1],
    ]);
  });

  it('returns the requested page', async () => {
    const get = await setup((db) => insertMany(db, 120));

    const body = employeeListResponseSchema.parse((await get('?page=3')).json());

    expect(body.page).toBe(3);
    expect(body.items).toHaveLength(20);
    expect(body.items[0]?.lastName).toBe('Surname100');
  });

  it('a page past the end returns no items and the real total', async () => {
    const get = await setup((db) => insertMany(db, 120));

    const response = await get('?page=9');

    expect(response.statusCode).toBe(200);
    const body = employeeListResponseSchema.parse(response.json());
    expect(body).toMatchObject({ items: [], page: 9, total: 120, totalPages: 3 });
  });

  it('returns terminated employees only when asked, or all of them', async () => {
    const get = await setup(async (db) => {
      await anEmployee().named('Ann', 'Active').insert(db);
      await anEmployee().named('Tom', 'Gone').terminatedOn('2025-01-31').insert(db);
    });

    const terminated = employeeListResponseSchema.parse((await get('?status=terminated')).json());
    const all = employeeListResponseSchema.parse((await get('?status=all')).json());

    expect(terminated.items.map((item) => item.lastName)).toEqual(['Gone']);
    expect(terminated.items[0]?.terminationDate).toBe('2025-01-31');
    expect(all.total).toBe(2);
  });

  it('rejects pageSize 30 and an unknown param with 400 VALIDATION_FAILED', async () => {
    const get = await setup(async () => {});

    for (const query of ['?pageSize=30', '?page=0', '?nope=IN']) {
      const response = await get(query);
      expect({ query, status: response.statusCode, code: response.json().code }).toEqual({
        query,
        status: 400,
        code: 'VALIDATION_FAILED',
      });
    }
  });

  describe('salary in local currency and USD, with compa-ratio and band position', () => {
    const band = generateBands().find(
      (b) => b.countryCode === 'IN' && b.jobTitleId === SOFTWARE_ENGINEER && b.levelCode === 'L3',
    )!;
    const INR_MICROS = 11_500;

    it.each([
      ['below', band.minMinor - 1],
      ['inside', band.minMinor],
      ['inside', band.midMinor],
      ['inside', band.maxMinor],
      ['above', band.maxMinor + 1],
    ] as const)('places %s the band a salary of %i', async (position, salaryMinor) => {
      const get = await setup(async (db) => {
        await anEmployee().inCountry('IN').withSalary(salaryMinor).insert(db);
      });

      const [item] = (await get()).json().items;

      expect(item).toMatchObject({
        salary: { amountMinor: salaryMinor, currency: 'INR' },
        salaryUsd: { amountMinor: toUsdMinor(salaryMinor, INR_MICROS), currency: 'USD' },
        compaRatio: compaRatio(salaryMinor, band.midMinor),
        bandPosition: position,
      });
    });

    it('shows a USD salary unchanged', async () => {
      const get = await setup(async (db) => {
        await anEmployee().inCountry('US').withSalary(12_345_600).insert(db);
      });

      const [item] = (await get()).json().items;

      expect(item.salary).toEqual({ amountMinor: 12_345_600, currency: 'USD' });
      expect(item.salaryUsd).toEqual({ amountMinor: 12_345_600, currency: 'USD' });
    });

    it('rounds the USD figure half up to the cent for each employee', async () => {
      // At 0.011500, 44 paise is 0.506 of a cent (rounds up to 1) and 43 is 0.4945 (rounds to 0).
      const get = await setup(async (db) => {
        await anEmployee().named('A', 'First').inCountry('IN').withSalary(44).insert(db);
        await anEmployee().named('B', 'Second').inCountry('IN').withSalary(43).insert(db);
      });

      const items = (await get()).json().items;

      expect(
        items.map((item: { salaryUsd: { amountMinor: number } }) => item.salaryUsd.amountMinor),
      ).toEqual([toUsdMinor(44, INR_MICROS), toUsdMinor(43, INR_MICROS)]);
    });
  });
});

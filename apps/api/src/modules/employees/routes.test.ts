import { compaRatio, employeeListResponseSchema, toUsdMinor } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs, merit } from '../../../test/builders/index.ts';
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

  describe('search q', () => {
    const namesOf = async (get: (q?: string) => Promise<{ json: () => unknown }>, q: string) =>
      employeeListResponseSchema
        .parse((await get(`?q=${encodeURIComponent(q)}`)).json())
        .items.map((item) => item.lastName);

    it('finds "Müller" when searching for "muller"', async () => {
      const get = await setup(async (db) => {
        await anEmployee().named('Jörg', 'Müller').insert(db);
        await anEmployee().named('Ann', 'Other').insert(db);
      });

      expect(await namesOf(get, 'muller')).toEqual(['Müller']);
      expect(await namesOf(get, '  JÖRG  mül')).toEqual(['Müller']);
    });

    it.each(['2', 'E2', 'e000002', '000002'])(
      'finds an employee by code written as %s',
      async (q) => {
        const get = await setup(async (db) => {
          await anEmployee().named('Ann', 'First').insert(db);
          await anEmployee().named('Bob', 'Second').insert(db);
          await anEmployee().named('Cy', 'Third').insert(db);
        });

        expect(await namesOf(get, q)).toEqual(['Second']);
      },
    );

    it('treats % and _ in the search text as literal characters', async () => {
      const get = await setup(async (db) => {
        await anEmployee().named('Ann', '100%Real').insert(db);
        await anEmployee().named('Bob', 'Under_score').insert(db);
        await anEmployee().named('Cy', 'Plain').insert(db);
      });

      expect(await namesOf(get, '%')).toEqual(['100%Real']);
      expect(await namesOf(get, '_')).toEqual(['Under_score']);
    });
  });

  describe('filters', () => {
    const lastNamesOf = async (get: (q?: string) => Promise<{ json: () => unknown }>, q: string) =>
      employeeListResponseSchema.parse((await get(q)).json()).items.map((item) => item.lastName);

    // Differs from the default employee (IN, Software Engineer, L3, female) on every filter.
    async function seedTargetAndOther(db: Db) {
      await anEmployee()
        .named('Tara', 'Target')
        .inCountry('US')
        .withTitle(3)
        .atLevel('L4')
        .withGender('male')
        .insert(db);
      await anEmployee().named('Olive', 'Other').insert(db);
    }

    it.each([
      ['country', '?country=US'],
      ['department', '?department=2'],
      ['job title', '?jobTitle=3'],
      ['level', '?level=L4'],
      ['gender', '?gender=male'],
    ])('filters by %s', async (_name, query) => {
      const get = await setup(seedTargetAndOther);

      expect(await lastNamesOf(get, query)).toEqual(['Target']);
    });

    it('combines department and job title with AND', async () => {
      const get = await setup(async (db) => {
        await anEmployee().named('Pam', 'Manager').withTitle(3).insert(db);
        await anEmployee().named('Dee', 'Designer').withTitle(4).insert(db);
      });

      expect(await lastNamesOf(get, '?department=2&jobTitle=4')).toEqual(['Designer']);
      expect(await lastNamesOf(get, '?department=1&jobTitle=4')).toEqual([]);
    });

    it('counts the filtered total, not the whole table', async () => {
      const get = await setup(seedTargetAndOther);

      const body = employeeListResponseSchema.parse((await get('?country=US')).json());

      expect(body).toMatchObject({ total: 1, totalPages: 1 });
    });

    it('combines different filters with AND and values within one filter with OR', async () => {
      const get = await setup(async (db) => {
        await anEmployee().named('A', 'InL3').inCountry('IN').atLevel('L3').insert(db);
        await anEmployee().named('B', 'UsL3').inCountry('US').atLevel('L3').insert(db);
        await anEmployee().named('C', 'UsL4').inCountry('US').atLevel('L4').insert(db);
        await anEmployee().named('D', 'DeL3').inCountry('DE').atLevel('L3').insert(db);
      });

      expect(await lastNamesOf(get, '?country=IN,US&level=L3')).toEqual(['InL3', 'UsL3']);
      expect(await lastNamesOf(get, '?level=L3,L4&country=US')).toEqual(['UsL3', 'UsL4']);
    });

    it.each([
      ['?country=IN,XX', 'country[1]'],
      ['?level=L3,L9', 'level[1]'],
      ['?department=1,99', 'department[1]'],
      ['?jobTitle=abc', 'jobTitle[0]'],
      ['?gender=female,robot', 'gender[1]'],
    ])('rejects an unknown value in %s with 400 and path %s', async (query, path) => {
      const get = await setup(async () => {});

      const response = await get(query);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ path }],
      });
    });
  });

  describe('band and stale-salary filters', () => {
    const inBand = generateBands().find(
      (b) => b.countryCode === 'IN' && b.jobTitleId === SOFTWARE_ENGINEER && b.levelCode === 'L3',
    )!;
    const lastNamesOf = async (get: (q?: string) => Promise<{ json: () => unknown }>, q: string) =>
      employeeListResponseSchema.parse((await get(q)).json()).items.map((item) => item.lastName);

    // Salary exactly at min and at max is inside the band (02 section 4).
    async function seedPositions(db: Db) {
      await anEmployee()
        .named('A', 'Below')
        .withSalary(inBand.minMinor - 1)
        .insert(db);
      await anEmployee().named('B', 'AtMin').withSalary(inBand.minMinor).insert(db);
      await anEmployee().named('C', 'Mid').withSalary(inBand.midMinor).insert(db);
      await anEmployee().named('D', 'AtMax').withSalary(inBand.maxMinor).insert(db);
      await anEmployee()
        .named('E', 'Above')
        .withSalary(inBand.maxMinor + 1)
        .insert(db);
    }

    it.each([
      ['below', ['Below']],
      ['above', ['Above']],
      ['outside', ['Above', 'Below']],
      ['inside', ['AtMax', 'AtMin', 'Mid']],
    ])('band=%s returns %j', async (band, expected) => {
      const get = await setup(seedPositions);

      expect(await lastNamesOf(get, `?band=${band}`)).toEqual(expected);
    });

    it('salaryUnchangedSince keeps employees whose salary date is before that date', async () => {
      const get = await setup(async (db) => {
        await anEmployee().named('A', 'Older').hiredOn('2023-06-14').insert(db);
        await anEmployee().named('B', 'OnTheDay').hiredOn('2023-06-15').insert(db);
        await anEmployee().named('C', 'Newer').hiredOn('2024-01-01').insert(db);
        await anEmployee()
          .named('D', 'Raised')
          .hiredOn('2020-01-01')
          .withHistory([merit('2024-02-01', 5)])
          .insert(db);
      });

      expect(await lastNamesOf(get, '?salaryUnchangedSince=2023-06-15')).toEqual(['Older']);
    });
  });

  describe('sort', () => {
    const lastNamesOf = async (get: (q?: string) => Promise<{ json: () => unknown }>, q: string) =>
      employeeListResponseSchema.parse((await get(q)).json()).items.map((item) => item.lastName);

    it('sorts by USD salary across currencies, with ties in id order', async () => {
      // At 0.011500, 1,000,000 paise is 11,500 cents, the same as a USD salary of 11,500.
      const get = await setup(async (db) => {
        await anEmployee().named('A', 'Low').inCountry('US').withSalary(5_000).insert(db);
        await anEmployee().named('B', 'TieIn').inCountry('IN').withSalary(1_000_000).insert(db);
        await anEmployee().named('C', 'TieUs').inCountry('US').withSalary(11_500).insert(db);
        await anEmployee().named('D', 'High').inCountry('IN').withSalary(3_000_000).insert(db);
        await anEmployee().named('E', 'Mid').inCountry('US').withSalary(20_000).insert(db);
      });

      expect(await lastNamesOf(get, '?sort=salaryUsd')).toEqual([
        'Low',
        'TieIn',
        'TieUs',
        'Mid',
        'High',
      ]);
      expect(await lastNamesOf(get, '?sort=salaryUsd&order=desc')).toEqual([
        'High',
        'Mid',
        'TieUs',
        'TieIn',
        'Low',
      ]);
    });

    it('lists every row once across pages when salaries tie', async () => {
      const get = await setup(async (db) => {
        for (let i = 0; i < 30; i++) {
          await anEmployee().named('Asha', `Same${i}`).withSalary(1_000_000).insert(db);
        }
      });

      const ids: number[] = [];
      for (const page of [1, 2]) {
        const body = employeeListResponseSchema.parse(
          (await get(`?sort=salaryUsd&pageSize=25&page=${page}`)).json(),
        );
        ids.push(...body.items.map((item) => item.id));
      }

      expect(ids).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    });

    it('sorts by hire date and by name in both orders', async () => {
      const get = await setup(async (db) => {
        await anEmployee().named('A', 'Bravo').hiredOn('2021-05-01').insert(db);
        await anEmployee().named('B', 'Charlie').hiredOn('2019-03-01').insert(db);
        await anEmployee().named('C', 'Alpha').hiredOn('2023-07-01').insert(db);
      });

      expect(await lastNamesOf(get, '?sort=hireDate')).toEqual(['Charlie', 'Bravo', 'Alpha']);
      expect(await lastNamesOf(get, '?sort=hireDate&order=desc')).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ]);
      expect(await lastNamesOf(get, '?sort=name&order=asc')).toEqual(['Alpha', 'Bravo', 'Charlie']);
      expect(await lastNamesOf(get, '?sort=name&order=desc')).toEqual([
        'Charlie',
        'Bravo',
        'Alpha',
      ]);
    });

    it('rejects an unknown param next to valid filters with 400 VALIDATION_FAILED', async () => {
      const get = await setup(async () => {});

      const response = await get('?country=IN&sort=name&order=asc&colour=red');

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_FAILED');
    });
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

const INR_MICROS = 11_500;

describe('GET /api/employees/:id (E2)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(seed: (db: Db) => Promise<number | void>) {
    const db = await testDb();
    const id = await seed(db);
    const { cookie } = await loggedInAs(db, 'hr_viewer');
    app = testApp({ db });
    return {
      id,
      get: (path: string | number | void = id) =>
        app!.inject({ method: 'GET', url: `/api/employees/${path}`, headers: { cookie } }),
    };
  }

  it('returns one employee with band min, mid and max, compa-ratio and timestamps', async () => {
    const band = generateBands().find(
      (b) => b.countryCode === 'IN' && b.jobTitleId === SOFTWARE_ENGINEER && b.levelCode === 'L3',
    )!;
    const { get } = await setup(async (db) => (await anEmployee().insert(db)).id);

    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: 1,
      employeeCode: 'E000001',
      firstName: 'Asha',
      lastName: 'Rao',
      gender: 'female',
      country: { code: 'IN', name: 'India' },
      department: { id: expect.any(Number), name: 'Engineering' },
      jobTitle: { id: SOFTWARE_ENGINEER, name: 'Software Engineer' },
      level: { code: 'L3', name: 'Senior' },
      status: 'active',
      hireDate: '2022-01-10',
      terminationDate: null,
      salary: { amountMinor: band.midMinor, currency: 'INR' },
      salaryUsd: { amountMinor: toUsdMinor(band.midMinor, INR_MICROS), currency: 'USD' },
      salaryEffectiveDate: '2022-01-10',
      compaRatio: 1,
      bandPosition: 'inside',
      band: {
        min: { amountMinor: band.minMinor, currency: 'INR' },
        mid: { amountMinor: band.midMinor, currency: 'INR' },
        max: { amountMinor: band.maxMinor, currency: 'INR' },
      },
      createdAt: '2022-01-10T00:00:00.000Z',
      updatedAt: '2022-01-10T00:00:00.000Z',
    });
  });

  it('returns 404 EMPLOYEE_NOT_FOUND for an unknown id and 400 for a non-integer id', async () => {
    const { get } = await setup(async (db) => (await anEmployee().insert(db)).id);

    const missing = await get(999);
    const malformed = await get('abc');
    const zero = await get(0);

    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'EMPLOYEE_NOT_FOUND' });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(zero.statusCode).toBe(400);
  });
});

describe('POST /api/employees (E3)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const bandMid = generateBands().find(
    (b) => b.countryCode === 'IN' && b.jobTitleId === SOFTWARE_ENGINEER && b.levelCode === 'L3',
  )!.midMinor;
  const validBody = {
    firstName: 'Meera',
    lastName: 'Iyer',
    gender: 'female',
    countryCode: 'IN',
    jobTitleId: SOFTWARE_ENGINEER,
    levelCode: 'L3',
    hireDate: '2026-10-01',
    startingSalary: { amountMinor: bandMid, currency: 'INR' },
  };

  async function setup(seed: (db: Db) => Promise<void> = async () => {}) {
    const db = await testDb();
    await seed(db);
    const { cookie, user } = await loggedInAs(db, 'hr_admin');
    app = testApp({ db });
    return {
      db,
      user,
      post: (body: object = validBody) =>
        app!.inject({ method: 'POST', url: '/api/employees', headers: { cookie }, payload: body }),
    };
  }

  const rows = async (db: Db, sql: string) =>
    (await db.$client.execute(sql)).rows.map((row) => ({ ...row }));

  it('creating an employee returns 201 with Location, the next employee code, and a hire history row on the hire date', async () => {
    const { db, user, post } = await setup(async (db) => {
      await anEmployee().insert(db);
      await anEmployee().insert(db);
    });

    const response = await post();

    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe('/api/employees/3');
    expect(response.json()).toMatchObject({
      id: 3,
      employeeCode: 'E000003',
      firstName: 'Meera',
      lastName: 'Iyer',
      status: 'active',
      terminationDate: null,
      hireDate: '2026-10-01',
      salary: { amountMinor: bandMid, currency: 'INR' },
      salaryEffectiveDate: '2026-10-01',
      compaRatio: 1,
      bandPosition: 'inside',
    });
    expect(
      await rows(
        db,
        'SELECT effective_date, amount_minor, currency_code, job_title_id, level_code, reason, changed_by_user_id FROM salary_changes WHERE employee_id = 3',
      ),
    ).toEqual([
      {
        effective_date: '2026-10-01',
        amount_minor: bandMid,
        currency_code: 'INR',
        job_title_id: SOFTWARE_ENGINEER,
        level_code: 'L3',
        reason: 'hire',
        changed_by_user_id: user.id,
      },
    ]);
  });

  it("the new employee's current-salary columns equal the hire row", async () => {
    const { db, post } = await setup();

    await post({ ...validBody, startingSalary: { amountMinor: bandMid + 777, currency: 'INR' } });

    expect(
      await rows(
        db,
        `SELECT e.salary_minor, e.salary_currency, e.salary_effective_date, e.name_search
         FROM employees e JOIN salary_changes s ON s.employee_id = e.id
         WHERE s.reason = 'hire' AND e.salary_minor = s.amount_minor
           AND e.salary_currency = s.currency_code AND e.salary_effective_date = s.effective_date`,
      ),
    ).toEqual([
      {
        salary_minor: bandMid + 777,
        salary_currency: 'INR',
        salary_effective_date: '2026-10-01',
        name_search: 'meera iyer',
      },
    ]);
  });
});

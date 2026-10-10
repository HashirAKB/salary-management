import { describe, expect, it } from 'vitest';
import {
  createEmployeeBodySchema,
  employeeListQuerySchema,
  serializeEmployeeListQuery,
  terminateBodySchema,
  updateEmployeeBodySchema,
} from './employee.ts';

describe('employeeListQuerySchema', () => {
  it('applies defaults page 1, pageSize 50 and status active', () => {
    const result = employeeListQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 1, pageSize: 50, status: 'active' });
  });

  it('coerces query-string values to numbers', () => {
    const result = employeeListQuerySchema.safeParse({
      page: '3',
      pageSize: '100',
      status: 'all',
    });

    expect(result.data).toEqual({ page: 3, pageSize: 100, status: 'all' });
  });

  it('rejects unknown params', () => {
    const result = employeeListQuerySchema.safeParse({ nope: 'nair' });

    expect(result.success).toBe(false);
  });

  it.each([0, -1, 1.5, 'abc'])('rejects page %s', (page) => {
    expect(employeeListQuerySchema.safeParse({ page }).success).toBe(false);
  });

  it.each([25, 50, 100])('accepts pageSize %s', (pageSize) => {
    expect(employeeListQuerySchema.safeParse({ pageSize }).data?.pageSize).toBe(pageSize);
  });

  it.each([0, 10, 30, 101, 'abc'])('rejects pageSize %s', (pageSize) => {
    expect(employeeListQuerySchema.safeParse({ pageSize }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(employeeListQuerySchema.safeParse({ status: 'gone' }).success).toBe(false);
  });

  it('splits, trims and de-duplicates comma lists, dropping empty values', () => {
    const result = employeeListQuerySchema.safeParse({
      country: 'IN, US,,IN,',
      department: ',',
      jobTitle: '3,4',
      level: 'L3',
      gender: 'female,male',
    });

    expect(result.data).toEqual({
      page: 1,
      pageSize: 50,
      status: 'active',
      country: ['IN', 'US'],
      department: [],
      jobTitle: ['3', '4'],
      level: ['L3'],
      gender: ['female', 'male'],
    });
  });

  it('trims q and accepts 1 to 100 characters', () => {
    expect(employeeListQuerySchema.safeParse({ q: '  nair ' }).data?.q).toBe('nair');
    expect(employeeListQuerySchema.safeParse({ q: 'a'.repeat(100) }).success).toBe(true);
  });

  it.each(['', '   ', 'a'.repeat(101)])('rejects q %j', (q) => {
    expect(employeeListQuerySchema.safeParse({ q }).success).toBe(false);
  });

  it.each(['below', 'above', 'outside', 'inside'])('accepts band %s', (band) => {
    expect(employeeListQuerySchema.safeParse({ band }).data).toMatchObject({ band });
  });

  it.each([
    { band: 'under' },
    { sort: 'salary' },
    { order: 'up' },
    { salaryUnchangedSince: '2026-13-01' },
    { salaryUnchangedSince: 'yesterday' },
  ])('rejects %j', (bad) => {
    expect(employeeListQuerySchema.safeParse(bad).success).toBe(false);
  });

  it('accepts sort, order and a salaryUnchangedSince date', () => {
    const result = employeeListQuerySchema.safeParse({
      sort: 'salaryUsd',
      order: 'desc',
      salaryUnchangedSince: '2025-10-09',
    });

    expect(result.data).toMatchObject({
      sort: 'salaryUsd',
      order: 'desc',
      salaryUnchangedSince: '2025-10-09',
    });
  });
});

describe('serializeEmployeeListQuery', () => {
  const parse = (raw: Record<string, string>) => employeeListQuerySchema.safeParse(raw);

  it('round-trips every filter through the URL serializer', () => {
    const first = parse({
      page: '3',
      pageSize: '25',
      status: 'all',
      q: 'mü ller',
      country: 'IN,US',
      department: '2,5',
      jobTitle: '7',
      level: 'L3,L4',
      gender: 'non_binary',
      band: 'outside',
      salaryUnchangedSince: '2025-10-09',
      sort: 'hireDate',
      order: 'desc',
    });
    expect(first.success).toBe(true);

    const search = serializeEmployeeListQuery(first.data!);
    const second = parse(Object.fromEntries(new URLSearchParams(search)));

    expect(second.data).toEqual(first.data);
  });

  it('leaves defaults and empty lists out of the URL', () => {
    const parsed = parse({ country: ',', status: 'active', page: '1', pageSize: '50' });

    expect(serializeEmployeeListQuery(parsed.data!)).toBe('');
  });

  it('writes lists comma-separated without spaces', () => {
    const parsed = parse({ country: 'IN,US', level: 'L3,L4' });

    expect(serializeEmployeeListQuery(parsed.data!)).toBe('country=IN,US&level=L3,L4');
  });
});

describe('CreateEmployeeBody', () => {
  const valid = {
    firstName: 'Asha',
    lastName: 'Rao',
    gender: 'female',
    countryCode: 'IN',
    jobTitleId: 1,
    levelCode: 'L3',
    hireDate: '2026-10-01',
    startingSalary: { amountMinor: 120_000_000, currency: 'INR' },
  };
  const paths = (input: unknown) =>
    createEmployeeBodySchema.safeParse(input).error?.issues.map((issue) => issue.path.join('.'));

  it('accepts a complete body', () => {
    expect(createEmployeeBodySchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(paths({ ...valid, status: 'active' })).toEqual(['']);
  });

  it('rejects a missing field, naming it', () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.hireDate;

    expect(paths(rest)).toEqual(['hireDate']);
  });

  it('rejects a hire date before 1990-01-01 and accepts that day', () => {
    expect(paths({ ...valid, hireDate: '1989-12-31' })).toEqual(['hireDate']);
    expect(createEmployeeBodySchema.safeParse({ ...valid, hireDate: '1990-01-01' }).success).toBe(
      true,
    );
  });

  it.each([0, -5, 1.5, 1_000_000_000_001])('rejects an amount of %s', (amountMinor) => {
    expect(paths({ ...valid, startingSalary: { amountMinor, currency: 'INR' } })).toEqual([
      'startingSalary.amountMinor',
    ]);
  });

  it.each([1, 1_000_000_000_000])('accepts an amount of %s', (amountMinor) => {
    const body = { ...valid, startingSalary: { amountMinor, currency: 'INR' } };

    expect(createEmployeeBodySchema.safeParse(body).success).toBe(true);
  });

  it('reports a bad name under its own field', () => {
    expect(paths({ ...valid, lastName: '=SUM(A1)' })).toEqual(['lastName']);
  });
});

describe('UpdateEmployeeBody', () => {
  it('rejects an empty object', () => {
    expect(updateEmployeeBodySchema.safeParse({}).success).toBe(false);
  });

  it('accepts any non-empty subset of the three fields', () => {
    expect(updateEmployeeBodySchema.safeParse({ gender: 'male' }).success).toBe(true);
    expect(updateEmployeeBodySchema.safeParse({ firstName: 'A', lastName: 'B' }).success).toBe(
      true,
    );
  });

  it.each(['jobTitleId', 'levelCode', 'countryCode', 'salary'])('rejects %s', (key) => {
    const result = updateEmployeeBodySchema.safeParse({ firstName: 'A', [key]: 'x' });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(key);
  });
});

describe('TerminateBody', () => {
  it('requires a valid ISO date', () => {
    expect(terminateBodySchema.safeParse({ terminationDate: '2026-10-09' }).success).toBe(true);
    expect(terminateBodySchema.safeParse({ terminationDate: '9 Oct' }).success).toBe(false);
    expect(terminateBodySchema.safeParse({}).success).toBe(false);
  });
});

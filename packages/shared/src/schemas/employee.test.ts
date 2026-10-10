import { describe, expect, it } from 'vitest';
import { employeeListQuerySchema, serializeEmployeeListQuery } from './employee.ts';

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
    const result = employeeListQuerySchema.safeParse({ q: 'nair' });

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

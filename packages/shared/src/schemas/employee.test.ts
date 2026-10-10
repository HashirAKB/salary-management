import { describe, expect, it } from 'vitest';
import { employeeListQuerySchema } from './employee.ts';

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
});

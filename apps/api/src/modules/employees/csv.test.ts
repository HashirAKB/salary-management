import type { EmployeeListItem } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { buildEmployeesCsv } from './csv.ts';

const BOM = '﻿';

const item = (overrides: Partial<EmployeeListItem> = {}): EmployeeListItem => ({
  id: 4217,
  employeeCode: 'E004217',
  firstName: 'Asha',
  lastName: 'Rao',
  gender: 'female',
  country: { code: 'IN', name: 'India' },
  department: { id: 1, name: 'Engineering' },
  jobTitle: { id: 1, name: 'Software Engineer' },
  level: { code: 'L3', name: 'Senior' },
  status: 'active',
  hireDate: '2022-01-10',
  terminationDate: null,
  salary: { amountMinor: 198_000_000, currency: 'INR' },
  salaryUsd: { amountMinor: 2_277_000, currency: 'USD' },
  salaryEffectiveDate: '2024-04-01',
  compaRatio: 0.97,
  bandPosition: 'inside',
  ...overrides,
});

const rowsOf = (csv: string): string[] => csv.slice(BOM.length).split('\r\n');

// First data row as a list of unquoted cells; assumes no embedded `","`.
const cells = (csv: string): string[] => rowsOf(csv)[1]!.slice(1, -1).split('","');

describe('buildEmployeesCsv', () => {
  it('starts with a BOM, uses CRLF, and has the header row in order', () => {
    const csv = buildEmployeesCsv([item(), item({ id: 2 })], '2026-09-30');

    expect(csv.startsWith(BOM)).toBe(true);
    const lines = rowsOf(csv);
    expect(lines[0]).toBe(
      [
        'Employee ID',
        'First name',
        'Last name',
        'Gender',
        'Country',
        'Department',
        'Job title',
        'Level',
        'Status',
        'Hire date',
        'Termination date',
        'Salary',
        'Currency',
        'Salary (USD)',
        'FX as of',
        'Compa-ratio',
        'Band position',
        'Salary effective date',
      ]
        .map((name) => `"${name}"`)
        .join(','),
    );
    expect(csv).not.toMatch(/[^\r]\n/);
    // header, two rows, and the empty piece after the final CRLF
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('');
  });

  it('has only the header row when there are no employees', () => {
    expect(rowsOf(buildEmployeesCsv([], '2026-09-30'))).toHaveLength(2);
  });

  it('doubles quotes inside fields and quotes every field', () => {
    const csv = buildEmployeesCsv([item({ firstName: 'Ann "Annie"', lastName: 'O,Brien' })], 'x');

    expect(rowsOf(csv)[1]!.startsWith('"E004217","Ann ""Annie""","O,Brien","Female",')).toBe(true);
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])(
    'prefixes a tab inside the quotes for text starting with %j',
    (text) => {
      const csv = buildEmployeesCsv([item({ firstName: text })], 'x');

      expect(csv).toContain(`,"\t${text}",`);
    },
  );

  it('does not touch text that merely contains a formula character', () => {
    const csv = buildEmployeesCsv([item({ firstName: 'a=b' })], 'x');

    expect(csv).toContain(',"a=b",');
  });

  it('writes plain decimals, 2 dp compa-ratio, reference gender names and empty dates', () => {
    const csv = buildEmployeesCsv([item({ gender: 'non_binary', compaRatio: 1 })], '2026-09-30');

    expect(cells(csv)).toEqual([
      'E004217',
      'Asha',
      'Rao',
      'Non-binary',
      'India',
      'Engineering',
      'Software Engineer',
      'L3 Senior',
      'Active',
      '2022-01-10',
      '',
      '1980000.00',
      'INR',
      '22770.00',
      '2026-09-30',
      '1.00',
      'Inside',
      '2024-04-01',
    ]);
  });

  it('writes the termination date and Terminated and Below when they apply', () => {
    const csv = buildEmployeesCsv(
      [item({ status: 'terminated', terminationDate: '2025-01-31', bandPosition: 'below' })],
      'x',
    );

    const row = cells(csv);
    expect([row[8], row[10], row[16]]).toEqual(['Terminated', '2025-01-31', 'Below']);
  });

  it('writes amounts under one major unit with a leading zero', () => {
    const csv = buildEmployeesCsv(
      [
        item({
          salary: { amountMinor: 5, currency: 'USD' },
          salaryUsd: { amountMinor: 105, currency: 'USD' },
        }),
      ],
      'x',
    );

    const row = cells(csv);
    expect([row[11], row[13]]).toEqual(['0.05', '1.05']);
  });
});

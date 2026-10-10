import type { EmployeeListItem } from '@acme/shared';
import { GENDERS } from '../../domain/genders.ts';

// D-044: UTF-8 BOM, CRLF, every field double-quoted, quotes doubled. Excel reads text that
// starts with = + - @ tab or CR as a formula, so a tab goes inside the quotes in front of it.
const BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

const HEADER = [
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
];

const field = (text: string): string =>
  `"${(FORMULA_START.test(text) ? `\t${text}` : text).replaceAll('"', '""')}"`;

// Plain decimal in major units, 2 dp, no grouping. Every v1 currency has 2 minor-unit digits.
const major = (amountMinor: number): string => {
  const abs = Math.abs(amountMinor);
  return `${amountMinor < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const row = (e: EmployeeListItem, fxAsOf: string): string[] => [
  e.employeeCode,
  e.firstName,
  e.lastName,
  GENDERS.find((g) => g.code === e.gender)?.name ?? e.gender,
  e.country.name,
  e.department.name,
  e.jobTitle.name,
  `${e.level.code} ${e.level.name}`,
  capitalise(e.status),
  e.hireDate,
  e.terminationDate ?? '',
  major(e.salary.amountMinor),
  e.salary.currency,
  major(e.salaryUsd.amountMinor),
  fxAsOf,
  e.compaRatio.toFixed(2),
  capitalise(e.bandPosition),
  e.salaryEffectiveDate,
];

export function buildEmployeesCsv(items: EmployeeListItem[], fxAsOf: string): string {
  const lines = [HEADER, ...items.map((item) => row(item, fxAsOf))];
  return BOM + lines.map((cells) => cells.map(field).join(',') + '\r\n').join('');
}

import { compaRatio, type EmployeeListQuery, type EmployeeListResponse } from '@acme/shared';
import { and, asc, count, eq, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { usdMinorSql } from '../../db/money-sql.ts';
import {
  countries,
  departments,
  employees,
  fxRates,
  jobTitles,
  levels,
  payBands,
} from '../../db/schema.ts';
import { fxAsOf } from '../auth/sessions.ts';

// E1 (04 section 5.4). Name order is last_name, first_name, id, which index I2 serves.
export async function listEmployees(
  db: Db,
  query: EmployeeListQuery,
): Promise<EmployeeListResponse> {
  const { page, pageSize, status } = query;
  const where: SQL | undefined = status === 'all' ? undefined : eq(employees.status, status);

  const [rows, [totals], asOf] = await Promise.all([
    db
      .select({
        employee: employees,
        country: countries,
        jobTitle: jobTitles,
        department: departments,
        level: levels,
        band: payBands,
        salaryUsdMinor: usdMinorSql(employees.salaryMinor, fxRates.usdPerUnitMicros),
      })
      .from(employees)
      .innerJoin(countries, eq(countries.code, employees.countryCode))
      .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
      .innerJoin(departments, eq(departments.id, jobTitles.departmentId))
      .innerJoin(levels, eq(levels.code, employees.levelCode))
      .innerJoin(fxRates, eq(fxRates.currencyCode, employees.salaryCurrency))
      // Every employee has a band (02 section 3).
      .innerJoin(
        payBands,
        and(
          eq(payBands.countryCode, employees.countryCode),
          eq(payBands.jobTitleId, employees.jobTitleId),
          eq(payBands.levelCode, employees.levelCode),
        ),
      )
      .where(where)
      .orderBy(asc(employees.lastName), asc(employees.firstName), asc(employees.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(employees).where(where),
    fxAsOf(db),
  ]);
  const total = totals?.total ?? 0;

  return {
    items: rows.map(
      ({ employee: e, country, jobTitle, department, level, band, salaryUsdMinor }) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        gender: e.gender,
        country: { code: country.code, name: country.name },
        department: { id: department.id, name: department.name },
        jobTitle: { id: jobTitle.id, name: jobTitle.name },
        level: { code: level.code, name: level.name },
        status: e.status,
        hireDate: e.hireDate,
        terminationDate: e.terminationDate,
        salary: { amountMinor: e.salaryMinor, currency: e.salaryCurrency },
        salaryUsd: { amountMinor: salaryUsdMinor, currency: 'USD' },
        salaryEffectiveDate: e.salaryEffectiveDate,
        compaRatio: compaRatio(e.salaryMinor, band.midMinor),
        // Equal to min or max is inside (02 section 4).
        bandPosition:
          e.salaryMinor < band.minMinor
            ? 'below'
            : e.salaryMinor > band.maxMinor
              ? 'above'
              : 'inside',
      }),
    ),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    fxAsOf: asOf,
  };
}

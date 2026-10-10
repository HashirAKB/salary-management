import { compaRatio, type EmployeeListQuery, type EmployeeListResponse } from '@acme/shared';
import { and, asc, count, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { usdMinorSql } from '../../db/money-sql.ts';
import {
  type Gender,
  type LevelCode,
  countries,
  genders,
  departments,
  employees,
  fxRates,
  jobTitles,
  levels,
  payBands,
} from '../../db/schema.ts';
import { parseSearch } from '../../domain/employee-search.ts';
import { AppError, type ProblemFieldError } from '../../http/problem.ts';
import { fxAsOf } from '../auth/sessions.ts';

// Values in the list filters must exist in the reference tables (brief ruling 1); the shared
// schema only checks their shape. The path names the offending item, e.g. `country[1]`.
async function checkListValues(db: Db, query: EmployeeListQuery): Promise<void> {
  const [countryRows, levelRows, departmentRows, titleRows] = await Promise.all([
    db.select({ key: countries.code }).from(countries),
    db.select({ key: levels.code }).from(levels),
    db.select({ key: departments.id }).from(departments),
    db.select({ key: jobTitles.id }).from(jobTitles),
  ]);
  const known = (rows: { key: string | number }[]) => new Set(rows.map((r) => String(r.key)));
  const checks = [
    ['country', query.country, known(countryRows)],
    ['department', query.department, known(departmentRows)],
    ['jobTitle', query.jobTitle, known(titleRows)],
    ['level', query.level, known(levelRows)],
    ['gender', query.gender, new Set<string>(genders)],
  ] as const;
  const errors: ProblemFieldError[] = [];
  for (const [name, values, allowed] of checks) {
    values?.forEach((value, index) => {
      if (!allowed.has(value)) {
        errors.push({ path: `${name}[${index}]`, message: `Unknown ${name} "${value}".` });
      }
    });
  }
  if (errors.length > 0) {
    const detail =
      errors.length === 1 ? '1 field is invalid.' : `${errors.length} fields are invalid.`;
    throw new AppError(400, 'VALIDATION_FAILED', detail, errors);
  }
}

// E1 (04 section 5.4). Name order is last_name, first_name, id, which index I2 serves.
export async function listEmployees(
  db: Db,
  query: EmployeeListQuery,
): Promise<EmployeeListResponse> {
  const { page, pageSize, status, q } = query;
  await checkListValues(db, query);
  const conditions: (SQL | undefined)[] = [
    status === 'all' ? undefined : eq(employees.status, status),
  ];
  if (q !== undefined) {
    const search = parseSearch(q);
    conditions.push(
      search.kind === 'code'
        ? eq(employees.employeeCode, search.code)
        : sql`instr(${employees.nameSearch}, ${search.text}) > 0`,
    );
  }
  if (query.country?.length) conditions.push(inArray(employees.countryCode, query.country));
  if (query.level?.length)
    conditions.push(inArray(employees.levelCode, query.level as LevelCode[]));
  if (query.gender?.length) {
    conditions.push(inArray(employees.gender, query.gender as Gender[]));
  }
  if (query.jobTitle?.length) {
    conditions.push(inArray(employees.jobTitleId, query.jobTitle.map(Number)));
  }
  if (query.department?.length) {
    conditions.push(
      inArray(
        employees.jobTitleId,
        db
          .select({ id: jobTitles.id })
          .from(jobTitles)
          .where(inArray(jobTitles.departmentId, query.department.map(Number))),
      ),
    );
  }
  const where = and(...conditions);

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

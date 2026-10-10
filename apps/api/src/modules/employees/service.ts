import {
  compaRatio,
  type CreateEmployeeBody,
  type EmployeeDetail,
  type EmployeeExportQuery,
  type EmployeeListItem,
  type EmployeeListQuery,
  type EmployeeListResponse,
} from '@acme/shared';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
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
import { buildEmployeesCsv } from './csv.ts';

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

const usdSalary = usdMinorSql(employees.salaryMinor, fxRates.usdPerUnitMicros);

// Every sort ends with id so that pages never repeat or skip a row; id follows the order.
function orderBy({ sort = 'name', order = 'asc' }: EmployeeListQuery): SQL[] {
  const dir = order === 'asc' ? asc : desc;
  const keys =
    sort === 'salaryUsd'
      ? [usdSalary]
      : sort === 'hireDate'
        ? [employees.hireDate]
        : [employees.lastName, employees.firstName];
  return [...keys, employees.id].map((key) => dir(key));
}

// The conditions every filter in E1 and X1 shares; (04 section 5.4).
function filterConditions(db: Db, query: EmployeeListQuery): SQL | undefined {
  const { status, q } = query;
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
  // Equal to min or max is inside (02 section 4).
  if (query.band === 'below') conditions.push(lt(employees.salaryMinor, payBands.minMinor));
  if (query.band === 'above') conditions.push(gt(employees.salaryMinor, payBands.maxMinor));
  if (query.band === 'outside') {
    conditions.push(
      or(
        lt(employees.salaryMinor, payBands.minMinor),
        gt(employees.salaryMinor, payBands.maxMinor),
      ),
    );
  }
  if (query.band === 'inside') {
    conditions.push(
      and(
        gte(employees.salaryMinor, payBands.minMinor),
        lte(employees.salaryMinor, payBands.maxMinor),
      ),
    );
  }
  if (query.salaryUnchangedSince) {
    conditions.push(lt(employees.salaryEffectiveDate, query.salaryUnchangedSince));
  }
  return and(...conditions);
}

// Every employee has a band (02 section 3); the band filters read its columns.
const bandJoin = and(
  eq(payBands.countryCode, employees.countryCode),
  eq(payBands.jobTitleId, employees.jobTitleId),
  eq(payBands.levelCode, employees.levelCode),
);

// Rows in the query's sort order; a limit pages them, no limit returns all of them.
async function selectItems(
  db: Db,
  query: EmployeeListQuery,
  paging?: { limit: number; offset: number },
): Promise<EmployeeListItem[]> {
  const select = db
    .select({
      employee: employees,
      country: countries,
      jobTitle: jobTitles,
      department: departments,
      level: levels,
      band: payBands,
      salaryUsdMinor: usdSalary,
    })
    .from(employees)
    .innerJoin(countries, eq(countries.code, employees.countryCode))
    .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
    .innerJoin(departments, eq(departments.id, jobTitles.departmentId))
    .innerJoin(levels, eq(levels.code, employees.levelCode))
    .innerJoin(fxRates, eq(fxRates.currencyCode, employees.salaryCurrency))
    .innerJoin(payBands, bandJoin)
    .where(filterConditions(db, query))
    .orderBy(...orderBy(query))
    .$dynamic();
  const rows = await (paging ? select.limit(paging.limit).offset(paging.offset) : select);
  return rows.map(
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
  );
}

// E1 (04 section 5.4). Name order is last_name, first_name, id, which index I2 serves.
export async function listEmployees(
  db: Db,
  query: EmployeeListQuery,
): Promise<EmployeeListResponse> {
  const { page, pageSize } = query;
  await checkListValues(db, query);
  const [items, [totals], asOf] = await Promise.all([
    selectItems(db, query, { limit: pageSize, offset: (page - 1) * pageSize }),
    db
      .select({ total: count() })
      .from(employees)
      .innerJoin(payBands, bandJoin)
      .where(filterConditions(db, query)),
    fxAsOf(db),
  ]);
  const total = totals?.total ?? 0;
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize), fxAsOf: asOf };
}

// X1 (04 section 5.7): every row matching the filters, in the list's sort order, as CSV.
export async function exportEmployees(db: Db, query: EmployeeExportQuery): Promise<string> {
  const listQuery = { ...query, page: 1, pageSize: 50 } as EmployeeListQuery;
  await checkListValues(db, listQuery);
  const [items, asOf] = await Promise.all([selectItems(db, listQuery), fxAsOf(db)]);
  return buildEmployeesCsv(items, asOf);
}

// E2 (04 section 5.4): one employee with its pay band.
export async function getEmployee(db: Db, id: number): Promise<EmployeeDetail> {
  const [row] = await db
    .select({
      employee: employees,
      country: countries,
      jobTitle: jobTitles,
      department: departments,
      level: levels,
      band: payBands,
      salaryUsdMinor: usdSalary,
    })
    .from(employees)
    .innerJoin(countries, eq(countries.code, employees.countryCode))
    .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
    .innerJoin(departments, eq(departments.id, jobTitles.departmentId))
    .innerJoin(levels, eq(levels.code, employees.levelCode))
    .innerJoin(fxRates, eq(fxRates.currencyCode, employees.salaryCurrency))
    .innerJoin(payBands, bandJoin)
    .where(eq(employees.id, id));
  if (!row) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
  const { employee: e, country, jobTitle, department, level, band } = row;
  const money = (amountMinor: number) => ({ amountMinor, currency: e.salaryCurrency });
  return {
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
    salary: money(e.salaryMinor),
    salaryUsd: { amountMinor: row.salaryUsdMinor, currency: 'USD' },
    salaryEffectiveDate: e.salaryEffectiveDate,
    compaRatio: compaRatio(e.salaryMinor, band.midMinor),
    bandPosition:
      e.salaryMinor < band.minMinor ? 'below' : e.salaryMinor > band.maxMinor ? 'above' : 'inside',
    band: { min: money(band.minMinor), mid: money(band.midMinor), max: money(band.maxMinor) },
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

// E3 (04 section 5.4): one write transaction inserts the employee and its hire history row.
export async function createEmployee(
  _db: Db,
  _body: CreateEmployeeBody,
  _context: { today: string; now: string; userId: number },
): Promise<EmployeeDetail> {
  throw new Error('not implemented');
}

import type { EmployeeListQuery, EmployeeListResponse } from '@acme/shared';
import { asc, count, eq, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { countries, departments, employees, jobTitles, levels } from '../../db/schema.ts';
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
      })
      .from(employees)
      .innerJoin(countries, eq(countries.code, employees.countryCode))
      .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
      .innerJoin(departments, eq(departments.id, jobTitles.departmentId))
      .innerJoin(levels, eq(levels.code, employees.levelCode))
      .where(where)
      .orderBy(asc(employees.lastName), asc(employees.firstName), asc(employees.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(employees).where(where),
    fxAsOf(db),
  ]);
  const total = totals?.total ?? 0;

  return {
    items: rows.map(({ employee: e, country, jobTitle, department, level }) => ({
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
      salaryEffectiveDate: e.salaryEffectiveDate,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    fxAsOf: asOf,
  };
}

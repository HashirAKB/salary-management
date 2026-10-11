import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import {
  countries,
  departments,
  employees,
  fxRates,
  jobTitles,
  levels,
  payBands,
  type Gender,
  type LevelCode,
} from '../../db/schema.ts';
import { GENDERS } from '../../domain/genders.ts';
import type { PayRow } from '../../domain/pay-query.ts';

export interface PayFilters {
  countries?: string[];
  departmentIds?: number[];
  jobTitleIds?: number[];
  levelCodes?: string[];
  genders?: string[];
}

function filterConditions(filters: PayFilters): SQL[] {
  const conditions: SQL[] = [eq(employees.status, 'active')];
  if (filters.countries?.length) conditions.push(inArray(employees.countryCode, filters.countries));
  if (filters.departmentIds?.length) {
    conditions.push(inArray(jobTitles.departmentId, filters.departmentIds));
  }
  if (filters.jobTitleIds?.length) {
    conditions.push(inArray(employees.jobTitleId, filters.jobTitleIds));
  }
  if (filters.levelCodes?.length) {
    conditions.push(inArray(employees.levelCode, filters.levelCodes as LevelCode[]));
  }
  if (filters.genders?.length)
    conditions.push(inArray(employees.gender, filters.genders as Gender[]));
  return conditions;
}

// Every active employee as a pay row (D-016), with the band and FX rate its figures need.
export async function loadActivePayRows(db: Db, filters: PayFilters = {}): Promise<PayRow[]> {
  return db
    .select({
      countryCode: employees.countryCode,
      departmentId: jobTitles.departmentId,
      jobTitleId: employees.jobTitleId,
      levelCode: employees.levelCode,
      gender: employees.gender,
      salaryMinor: employees.salaryMinor,
      currency: employees.salaryCurrency,
      usdPerUnitMicros: fxRates.usdPerUnitMicros,
      bandMinMinor: payBands.minMinor,
      bandMaxMinor: payBands.maxMinor,
      salaryEffectiveDate: employees.salaryEffectiveDate,
    })
    .from(employees)
    .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
    .innerJoin(fxRates, eq(fxRates.currencyCode, employees.salaryCurrency))
    .innerJoin(
      payBands,
      and(
        eq(payBands.countryCode, employees.countryCode),
        eq(payBands.jobTitleId, employees.jobTitleId),
        eq(payBands.levelCode, employees.levelCode),
      ),
    )
    .where(and(...filterConditions(filters)))
    .orderBy(asc(employees.id));
}

export async function loadCountryNames(db: Db): Promise<Record<string, string>> {
  const rows = await db.select({ code: countries.code, name: countries.name }).from(countries);
  return Object.fromEntries(rows.map((r) => [r.code, r.name]));
}

async function namesOf(
  rows: Promise<{ key: string | number; name: string }[]>,
): Promise<Record<string, string>> {
  return Object.fromEntries((await rows).map((r) => [String(r.key), r.name]));
}

// Group labels for the I2 dimensions, keyed as the engine keys its groups.
export async function loadGroupLabels(
  db: Db,
  groupBy: 'country' | 'department' | 'jobTitle' | 'level' | 'gender',
): Promise<Record<string, string>> {
  switch (groupBy) {
    case 'country':
      return loadCountryNames(db);
    case 'department':
      return namesOf(db.select({ key: departments.id, name: departments.name }).from(departments));
    case 'jobTitle':
      return namesOf(db.select({ key: jobTitles.id, name: jobTitles.name }).from(jobTitles));
    case 'level':
      return namesOf(
        db
          .select({ key: levels.code, name: levels.name })
          .from(levels)
          .then((rows) => rows.map((r) => ({ key: r.key, name: `${r.key} ${r.name}` }))),
      );
    case 'gender':
      return Object.fromEntries(GENDERS.map((g) => [g.code, g.name]));
  }
}

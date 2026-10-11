import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { countries, employees, fxRates, jobTitles, payBands } from '../../db/schema.ts';
import type { PayRow } from '../../domain/pay-query.ts';

// Every active employee as a pay row (D-016), with the band and FX rate its figures need.
export async function loadActivePayRows(db: Db): Promise<PayRow[]> {
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
    .where(eq(employees.status, 'active'))
    .orderBy(asc(employees.id));
}

export async function loadCountryNames(db: Db): Promise<Record<string, string>> {
  const rows = await db.select({ code: countries.code, name: countries.name }).from(countries);
  return Object.fromEntries(rows.map((r) => [r.code, r.name]));
}

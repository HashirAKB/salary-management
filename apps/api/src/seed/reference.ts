import type { countries, departments, fxRates, jobTitles, levels, payBands } from '../db/schema.ts';

export type FxRateRow = typeof fxRates.$inferInsert;
export type CountryRow = typeof countries.$inferInsert;
export type DepartmentRow = typeof departments.$inferInsert;
export type JobTitleRow = typeof jobTitles.$inferInsert & { id: number };
export type LevelRow = typeof levels.$inferInsert;
export type PayBandRow = typeof payBands.$inferInsert;

export type ReferenceData = {
  fxRates: FxRateRow[];
  countries: CountryRow[];
  departments: DepartmentRow[];
  jobTitles: JobTitleRow[];
  levels: LevelRow[];
  payBands: PayBandRow[];
};

// The seed's reference data and the pure band generator (02 sections 4, 7.3 and 7.4).
export function generateReferenceData(): ReferenceData {
  throw new Error('not implemented');
}

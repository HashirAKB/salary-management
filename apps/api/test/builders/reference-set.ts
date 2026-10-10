import type { LevelCode } from '../../src/db/schema.ts';
import {
  countries,
  departments,
  fxRates,
  jobTitles,
  levels,
  payBands,
} from '../../src/db/schema.ts';
import { generateReferenceData } from '../../src/seed/reference.ts';
import type { DbOrTx } from './db.ts';

// The seed's FX rates, countries, departments, titles, levels and all 250 bands (05 section 4.2).
class ReferenceSetBuilder {
  readonly #without: string[] = [];

  withoutBand(countryCode: string, jobTitleId: number, levelCode: LevelCode): this {
    this.#without.push(`${countryCode}/${jobTitleId}/${levelCode}`);
    return this;
  }

  async insert(db: DbOrTx): Promise<void> {
    const ref = generateReferenceData();
    const bands = ref.payBands.filter(
      (b) => !this.#without.includes(`${b.countryCode}/${b.jobTitleId}/${b.levelCode}`),
    );
    await db.insert(fxRates).values(ref.fxRates);
    await db.insert(countries).values(ref.countries);
    await db.insert(departments).values(ref.departments);
    await db.insert(jobTitles).values(ref.jobTitles);
    await db.insert(levels).values(ref.levels);
    await db.insert(payBands).values(bands);
  }
}

export const aReferenceSet = () => new ReferenceSetBuilder();

import {
  base,
  de,
  en,
  en_CA,
  en_GB,
  en_IN,
  en_US,
  Faker,
  type LocaleDefinition,
} from '@faker-js/faker';
import type { employees, Gender, LevelCode, salaryChanges } from '../db/schema.ts';
import { nameSearch } from '../domain/name-search.ts';
import { createRandom, largestRemainder, type Random } from './random.ts';
import {
  COUNTRIES,
  generateReferenceData,
  JOB_TITLES,
  LEVELS,
  type CountrySpec,
  type PayBandRow,
  type ReferenceData,
} from './reference.ts';

export const SEED = 20261011;
export const REF_DATE = '2026-09-30';

export type EmployeeRow = typeof employees.$inferInsert & { id: number };
export type SalaryChangeRow = typeof salaryChanges.$inferInsert & { id: number };

export type Dataset = ReferenceData & {
  employees: EmployeeRow[];
  salaryChanges: SalaryChangeRow[];
};

export type SeedConfig = {
  terminatedCount: number;
};

export const SEED_CONFIG: SeedConfig = { terminatedCount: 250 };

const LOCALES: Record<CountrySpec['locale'], LocaleDefinition> = { en_CA, de, en_GB, en_IN, en_US };

const GENDERS: readonly Gender[] = ['female', 'male', 'non_binary', 'not_disclosed'];

/** A generated person before ids, codes and history are assigned. */
type Person = {
  countryCode: string;
  jobTitleId: number;
  levelCode: LevelCode;
  gender: Gender;
  firstName: string;
  lastName: string;
  band: PayBandRow;
};

const bandKey = (countryCode: string, jobTitleId: number, levelCode: string) =>
  `${countryCode}/${jobTitleId}/${levelCode}`;

function namesFor(country: CountrySpec, countryIndex: number, seed: number, refDate: string) {
  const faker = new Faker({ locale: [LOCALES[country.locale], en, base] });
  faker.seed(seed + countryIndex);
  faker.setDefaultRefDate(refDate);
  return (gender: Gender) => ({
    firstName:
      gender === 'female' || gender === 'male'
        ? faker.person.firstName(gender)
        : faker.person.firstName(),
    lastName: faker.person.lastName(),
  });
}

// 02 section 7.5: cohort counts by largest remainder per country, then genders per cohort.
function allocateActive(seed: number, refDate: string, bands: Map<string, PayBandRow>): Person[] {
  const people: Person[] = [];
  const cohortWeights = JOB_TITLES.flatMap((t) => LEVELS.map((l) => t.share * l.share));
  COUNTRIES.forEach((country, countryIndex) => {
    const nameOf = namesFor(country, countryIndex, seed, refDate);
    const cohortCounts = largestRemainder(country.activeHeadcount, cohortWeights);
    let cohort = 0;
    for (const title of JOB_TITLES) {
      for (const level of LEVELS) {
        const size = cohortCounts[cohort++] ?? 0;
        const w = Math.min(0.9, title.womenShare * level.womenFactor);
        const genderCounts = largestRemainder(size, [0.97 * w, 0.97 * (1 - w), 0.01, 0.02]);
        const band = bands.get(bandKey(country.code, title.id, level.code));
        if (!band) throw new Error(`No band for ${bandKey(country.code, title.id, level.code)}`);
        GENDERS.forEach((gender, g) => {
          for (let i = 0; i < (genderCounts[g] ?? 0); i++) {
            people.push({
              countryCode: country.code,
              jobTitleId: title.id,
              levelCode: level.code,
              gender,
              ...nameOf(gender),
              band,
            });
          }
        });
      }
    }
  });
  return people;
}

const code = (n: number) => `E${String(n).padStart(6, '0')}`;

function toRows(people: Person[], random: Random, refDate: string) {
  const employeeRows: EmployeeRow[] = [];
  const changeRows: SalaryChangeRow[] = [];
  random.shuffle(people).forEach((person, index) => {
    const id = index + 1;
    const hireDate = refDate;
    const createdAt = `${hireDate}T00:00:00.000Z`;
    employeeRows.push({
      id,
      employeeCode: code(id),
      firstName: person.firstName,
      lastName: person.lastName,
      nameSearch: nameSearch(person.firstName, person.lastName),
      gender: person.gender,
      countryCode: person.countryCode,
      jobTitleId: person.jobTitleId,
      levelCode: person.levelCode,
      hireDate,
      status: 'active',
      terminationDate: null,
      salaryMinor: person.band.midMinor,
      salaryCurrency: person.band.currencyCode,
      salaryEffectiveDate: hireDate,
      createdAt,
      updatedAt: createdAt,
    });
    changeRows.push({
      id: changeRows.length + 1,
      employeeId: id,
      effectiveDate: hireDate,
      amountMinor: person.band.midMinor,
      currencyCode: person.band.currencyCode,
      jobTitleId: person.jobTitleId,
      levelCode: person.levelCode,
      reason: 'hire',
      changedByUserId: null,
      createdAt,
    });
  });
  return { employeeRows, changeRows };
}

// generateDataset: pure, no DB, no clock, no env (02 section 7.1).
export function generateDataset(_config: SeedConfig, seed: number, refDate: string): Dataset {
  const reference = generateReferenceData();
  const bands = new Map(
    reference.payBands.map((b) => [bandKey(b.countryCode, b.jobTitleId, b.levelCode), b]),
  );
  const random = createRandom(seed);
  const people = allocateActive(seed, refDate, bands);
  const { employeeRows, changeRows } = toRows(people, random, refDate);
  return { ...reference, employees: employeeRows, salaryChanges: changeRows };
}

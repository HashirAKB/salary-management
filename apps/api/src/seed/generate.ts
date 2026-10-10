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
  ACCOUNT_EXECUTIVE,
  COUNTRIES,
  generateReferenceData,
  JOB_TITLES,
  LEVELS,
  type CountrySpec,
  type PayBandRow,
  type ReferenceData,
  SOFTWARE_ENGINEER,
} from './reference.ts';

export const SEED = 20261011;
export const REF_DATE = '2026-09-30';

export type EmployeeRow = typeof employees.$inferInsert & { id: number };
export type SalaryChangeRow = typeof salaryChanges.$inferInsert & { id: number };

export type Dataset = ReferenceData & {
  employees: EmployeeRow[];
  salaryChanges: SalaryChangeRow[];
};

export type GapTarget = {
  countryCode: string;
  jobTitleId: number;
  levelCode: LevelCode;
  gapPct: number;
};

export type SeedConfig = {
  terminatedCount: number;
  /** Realised gender gaps for named cohorts (02 section 7.6 step 2). */
  gapTargets: readonly GapTarget[];
  /** Every other eligible cohort draws its gap uniformly in [-x, +x]. */
  otherGapRangePct: number;
  /** Share of active employees outside the target cohorts moved below band, and again above. */
  outlierShare: number;
};

export const SEED_CONFIG: SeedConfig = {
  terminatedCount: 250,
  gapTargets: [
    { countryCode: 'IN', jobTitleId: SOFTWARE_ENGINEER, levelCode: 'L3', gapPct: 8.0 },
    { countryCode: 'US', jobTitleId: ACCOUNT_EXECUTIVE, levelCode: 'L2', gapPct: 6.0 },
    { countryCode: 'GB', jobTitleId: SOFTWARE_ENGINEER, levelCode: 'L4', gapPct: 5.3 },
    { countryCode: 'DE', jobTitleId: SOFTWARE_ENGINEER, levelCode: 'L2', gapPct: 4.7 },
  ],
  otherGapRangePct: 2.0,
  outlierShare: 0.03,
};

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
  salaryMinor: number;
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
              salaryMinor: band.midMinor,
            });
          }
        });
      }
    }
  });
  return people;
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** Salary rounding step in minor units: 100 major units, 1,000 for INR (02 section 7.6 step 4). */
const salaryStepMinor = (currencyCode: string) => (currencyCode === 'INR' ? 1000 : 100) * 100;

const roundSalary = (amountMinor: number, currencyCode: string) => {
  const step = salaryStepMinor(currencyCode);
  return Math.round(amountMinor / step) * step;
};

// 02 section 7.6: compa-ratio draws, outliers outside the target cohorts, then one factor on
// women's pay per eligible cohort so the realised gap meets its target, then rounding.
function shapeSalaries(people: Person[], random: Random, config: SeedConfig): void {
  const targets = new Map(
    config.gapTargets.map((t) => [bandKey(t.countryCode, t.jobTitleId, t.levelCode), t.gapPct]),
  );
  const compa = people.map(() => Math.min(1.16, Math.max(0.84, random.normal(1, 0.06))));

  const outlierPool = random.shuffle(
    people.flatMap((p, i) =>
      targets.has(bandKey(p.countryCode, p.jobTitleId, p.levelCode)) ? [] : [i],
    ),
  );
  const outliers = Math.round(outlierPool.length * config.outlierShare);
  outlierPool.slice(0, outliers).forEach((i) => (compa[i] = random.uniform(0.65, 0.76)));
  outlierPool.slice(outliers, 2 * outliers).forEach((i) => (compa[i] = random.uniform(1.25, 1.4)));

  const raw = people.map((p, i) => (compa[i] ?? 1) * p.band.midMinor);

  const cohorts = new Map<string, { women: number[]; men: number[] }>();
  people.forEach((p, i) => {
    const key = bandKey(p.countryCode, p.jobTitleId, p.levelCode);
    const cohort = cohorts.get(key) ?? { women: [], men: [] };
    if (p.gender === 'female') cohort.women.push(i);
    if (p.gender === 'male') cohort.men.push(i);
    cohorts.set(key, cohort);
  });
  for (const [key, { women, men }] of cohorts) {
    if (women.length < 5 || men.length < 5) continue;
    const target =
      targets.get(key) ?? random.uniform(-config.otherGapRangePct, config.otherGapRangePct);
    const meanMen = mean(men.map((i) => raw[i] ?? 0));
    const meanWomen = mean(women.map((i) => raw[i] ?? 0));
    const factor = (meanMen * (1 - target / 100)) / meanWomen;
    for (const i of women) raw[i] = (raw[i] ?? 0) * factor;
  }

  people.forEach((p, i) => {
    p.salaryMinor = roundSalary(raw[i] ?? 0, p.band.currencyCode);
  });
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
      salaryMinor: person.salaryMinor,
      salaryCurrency: person.band.currencyCode,
      salaryEffectiveDate: hireDate,
      createdAt,
      updatedAt: createdAt,
    });
    changeRows.push({
      id: changeRows.length + 1,
      employeeId: id,
      effectiveDate: hireDate,
      amountMinor: person.salaryMinor,
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
export function generateDataset(config: SeedConfig, seed: number, refDate: string): Dataset {
  const reference = generateReferenceData();
  const bands = new Map(
    reference.payBands.map((b) => [bandKey(b.countryCode, b.jobTitleId, b.levelCode), b]),
  );
  const random = createRandom(seed);
  const people = allocateActive(seed, refDate, bands);
  shapeSalaries(people, random, config);
  const { employeeRows, changeRows } = toRows(people, random, refDate);
  return { ...reference, employees: employeeRows, salaryChanges: changeRows };
}

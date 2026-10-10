import type { Gender, LevelCode, SalaryChangeReason } from '../../src/db/schema.ts';
import { employees, salaryChanges } from '../../src/db/schema.ts';
import { COUNTRIES, generateBands, SOFTWARE_ENGINEER } from '../../src/seed/reference.ts';
import { nextId, type DbOrTx } from './db.ts';

export type HistoryEntry = {
  reason: Exclude<SalaryChangeReason, 'hire'>;
  effectiveDate: string;
  changePct: number;
  /** The level from this row on; promotions only. */
  levelCode?: LevelCode;
};

export const merit = (effectiveDate: string, changePct: number): HistoryEntry => ({
  reason: 'merit',
  effectiveDate,
  changePct,
});
export const marketAdjustment = (effectiveDate: string, changePct: number): HistoryEntry => ({
  reason: 'market_adjustment',
  effectiveDate,
  changePct,
});
export const correction = (effectiveDate: string, changePct: number): HistoryEntry => ({
  reason: 'correction',
  effectiveDate,
  changePct,
});
export const promotion = (
  effectiveDate: string,
  levelCode: LevelCode,
  changePct: number,
): HistoryEntry => ({ reason: 'promotion', effectiveDate, changePct, levelCode });

export type InsertedEmployee = { id: number; employeeCode: string };

/**
 * Active, India, Software Engineer, L3, female, salary at band mid, hired 2022-01-10, one hire row
 * (05 section 4.2). With withHistory, atLevel and withSalary describe the hire row; each entry
 * applies its change in order, and the current-salary columns equal the last row.
 */
class EmployeeBuilder {
  #countryCode = 'IN';
  #jobTitleId = SOFTWARE_ENGINEER;
  #levelCode: LevelCode = 'L3';
  #gender: Gender = 'female';
  #firstName = 'Asha';
  #lastName = 'Rao';
  #salaryMinor: number | undefined;
  #hireDate = '2022-01-10';
  #terminationDate: string | undefined;
  #history: HistoryEntry[] = [];

  inCountry(code: string): this {
    this.#countryCode = code;
    return this;
  }
  withTitle(jobTitleId: number): this {
    this.#jobTitleId = jobTitleId;
    return this;
  }
  atLevel(code: LevelCode): this {
    this.#levelCode = code;
    return this;
  }
  withGender(gender: Gender): this {
    this.#gender = gender;
    return this;
  }
  named(firstName: string, lastName: string): this {
    this.#firstName = firstName;
    this.#lastName = lastName;
    return this;
  }
  withSalary(amountMinor: number): this {
    this.#salaryMinor = amountMinor;
    return this;
  }
  hiredOn(date: string): this {
    this.#hireDate = date;
    return this;
  }
  terminatedOn(date: string): this {
    this.#terminationDate = date;
    return this;
  }
  withHistory(entries: HistoryEntry[]): this {
    this.#history = entries;
    return this;
  }

  async insert(db: DbOrTx): Promise<InsertedEmployee> {
    const currency = COUNTRIES.find((c) => c.code === this.#countryCode)?.currencyCode ?? 'USD';
    const band = generateBands().find(
      (b) =>
        b.countryCode === this.#countryCode &&
        b.jobTitleId === this.#jobTitleId &&
        b.levelCode === this.#levelCode,
    );
    const rows = [
      {
        reason: 'hire' as SalaryChangeReason,
        effectiveDate: this.#hireDate,
        amountMinor: this.#salaryMinor ?? band?.midMinor ?? 10_000_000,
        levelCode: this.#levelCode,
      },
    ];
    for (const entry of this.#history) {
      const previous = rows[rows.length - 1]!;
      rows.push({
        reason: entry.reason,
        effectiveDate: entry.effectiveDate,
        amountMinor: Math.round(previous.amountMinor * (1 + entry.changePct / 100)),
        levelCode: entry.levelCode ?? previous.levelCode,
      });
    }
    const current = rows[rows.length - 1]!;
    const id = await nextId(db, 'employees');
    const employeeCode = `E${String(id).padStart(6, '0')}`;
    const createdAt = `${this.#hireDate}T00:00:00.000Z`;

    await db.insert(employees).values({
      id,
      employeeCode,
      firstName: this.#firstName,
      lastName: this.#lastName,
      nameSearch: `${this.#firstName} ${this.#lastName}`.toLowerCase(),
      gender: this.#gender,
      countryCode: this.#countryCode,
      jobTitleId: this.#jobTitleId,
      levelCode: current.levelCode,
      hireDate: this.#hireDate,
      status: this.#terminationDate ? 'terminated' : 'active',
      terminationDate: this.#terminationDate ?? null,
      salaryMinor: current.amountMinor,
      salaryCurrency: currency,
      salaryEffectiveDate: current.effectiveDate,
      createdAt,
      updatedAt: createdAt,
    });
    let changeId = await nextId(db, 'salary_changes');
    await db.insert(salaryChanges).values(
      rows.map((row) => ({
        id: changeId++,
        employeeId: id,
        effectiveDate: row.effectiveDate,
        amountMinor: row.amountMinor,
        currencyCode: currency,
        jobTitleId: this.#jobTitleId,
        levelCode: row.levelCode,
        reason: row.reason,
        changedByUserId: null,
        createdAt: `${row.effectiveDate}T00:00:00.000Z`,
      })),
    );
    return { id, employeeCode };
  }
}

export const anEmployee = () => new EmployeeBuilder();

import {
  changePct,
  type EmployeeDetail,
  type SalaryChangeBody,
  type SalaryChangeItem,
  type SalaryHistoryResponse,
} from '@acme/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { employees, jobTitles, levels, payBands, salaryChanges, users } from '../../db/schema.ts';
import { checkSalaryChange, type SalaryRuleCode } from '../../domain/salary-rules.ts';
import { AppError } from '../../http/problem.ts';
import { getEmployee } from '../employees/service.ts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// The two writes of a salary change. The service runs them in one transaction (D-021); a test
// injects a failing implementation to prove neither is kept when the second one throws.
export interface SalaryWrites {
  insertChange(tx: Tx, row: typeof salaryChanges.$inferInsert): Promise<number>;
  updateEmployee(tx: Tx, id: number, values: Partial<typeof employees.$inferInsert>): Promise<void>;
}

export const drizzleSalaryWrites: SalaryWrites = {
  async insertChange(tx, row) {
    const [inserted] = await tx
      .insert(salaryChanges)
      .values(row)
      .returning({ id: salaryChanges.id });
    return inserted!.id;
  },
  async updateEmployee(tx, id, values) {
    await tx.update(employees).set(values).where(eq(employees.id, id));
  },
};

const RULE_MESSAGES: Record<SalaryRuleCode, string> = {
  EMPLOYEE_TERMINATED: 'This employee is terminated, so their salary can no longer change.',
  DATE_IN_FUTURE: "Effective date can't be in the future.",
  SALARY_DATE_BEFORE_CURRENT: "Effective date can't be before the current salary's date.",
  SALARY_CURRENCY_MISMATCH: "Salary must be in the employee's currency.",
  RAISE_REQUIRED: 'The new salary must be higher than the current salary.',
  POSITION_MUST_NOT_CHANGE: "Job title and level can't change with this reason.",
  PROMOTION_LEVEL_NOT_HIGHER: 'A promotion needs a higher level.',
  CORRECTION_NO_CHANGE: 'A correction must change the salary, job title or level.',
  NO_PAY_BAND: "There's no pay band for this country, job title and level.",
};

// S2 (04 section 5.5): checks the rules, then writes the history row and the employee together.
export async function recordSalaryChange(
  db: Db,
  employeeId: number,
  body: SalaryChangeBody,
  context: { today: string; now: string; userId: number },
  writes: SalaryWrites = drizzleSalaryWrites,
): Promise<{ employee: EmployeeDetail; change: SalaryChangeItem }> {
  const [current] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!current) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
  const levelRows = await db.select().from(levels);
  const rank = (code: string) => levelRows.find((level) => level.code === code)?.rank ?? 0;
  const [band] = await db
    .select({ countryCode: payBands.countryCode })
    .from(payBands)
    .where(
      and(
        eq(payBands.countryCode, current.countryCode),
        eq(payBands.jobTitleId, body.jobTitleId),
        eq(payBands.levelCode, body.levelCode),
      ),
    );

  const code = checkSalaryChange({
    today: context.today,
    employee: {
      status: current.status,
      salary: { amountMinor: current.salaryMinor, currency: current.salaryCurrency },
      salaryEffectiveDate: current.salaryEffectiveDate,
      jobTitleId: current.jobTitleId,
      levelRank: rank(current.levelCode),
    },
    change: {
      reason: body.reason,
      effectiveDate: body.effectiveDate,
      amount: body.amount,
      jobTitleId: body.jobTitleId,
      levelRank: rank(body.levelCode),
    },
    hasPayBand: band !== undefined,
  });
  if (code) throw new AppError(422, code, RULE_MESSAGES[code]);

  const changeId = await db.transaction(async (tx) => {
    const id = await writes.insertChange(tx, {
      employeeId,
      effectiveDate: body.effectiveDate,
      amountMinor: body.amount.amountMinor,
      currencyCode: body.amount.currency,
      jobTitleId: body.jobTitleId,
      levelCode: body.levelCode,
      reason: body.reason,
      changedByUserId: context.userId,
      createdAt: context.now,
    });
    await writes.updateEmployee(tx, employeeId, {
      salaryMinor: body.amount.amountMinor,
      salaryEffectiveDate: body.effectiveDate,
      jobTitleId: body.jobTitleId,
      levelCode: body.levelCode,
      updatedAt: context.now,
    });
    return id;
  });

  const [titleRows, [recorder]] = await Promise.all([
    db
      .select()
      .from(jobTitles)
      .where(inArray(jobTitles.id, [current.jobTitleId, body.jobTitleId])),
    db.select({ displayName: users.displayName }).from(users).where(eq(users.id, context.userId)),
  ]);
  const title = (id: number) => {
    const row = titleRows.find((t) => t.id === id)!;
    return { id: row.id, name: row.name };
  };
  const level = (code: string) => {
    const row = levelRows.find((l) => l.code === code)!;
    return { code: row.code, name: row.name };
  };
  const previousAmount = { amountMinor: current.salaryMinor, currency: current.salaryCurrency };
  const change: SalaryChangeItem = {
    id: changeId,
    effectiveDate: body.effectiveDate,
    reason: body.reason,
    amount: body.amount,
    previousAmount,
    changePct: changePct(previousAmount.amountMinor, body.amount.amountMinor),
    jobTitle: title(body.jobTitleId),
    level: level(body.levelCode),
    previousJobTitle: title(current.jobTitleId),
    previousLevel: level(current.levelCode),
    changedBy: recorder ? { displayName: recorder.displayName } : null,
    createdAt: context.now,
  };
  return { employee: await getEmployee(db, employeeId), change };
}

// S1 (04 section 5.5): the employee's history, newest first.
export async function listSalaryHistory(
  _db: Db,
  _employeeId: number,
): Promise<SalaryHistoryResponse> {
  throw new Error('not implemented');
}

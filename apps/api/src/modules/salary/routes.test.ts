import { changePct } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { aReferenceSet, anEmployee, loggedInAs } from '../../../test/builders/index.ts';
import { currentSalaryMismatches } from '../../../test/invariants.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import type { Db } from '../../db/client.ts';
import { SOFTWARE_ENGINEER } from '../../seed/reference.ts';

const NOW = '2026-10-09T09:00:00.000Z';

describe('POST /api/employees/:id/salary-changes (S2)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // An active L3 Software Engineer in India, hired 2022-01-10, signed in as HR Admin.
  async function setup(
    options: { reference?: ReturnType<typeof aReferenceSet>; terminated?: boolean } = {},
  ) {
    const db = await testDb(options.reference);
    const { id } = await (
      options.terminated ? anEmployee().terminatedOn('2026-09-30') : anEmployee()
    ).insert(db);
    const { cookie, user } = await loggedInAs(db, 'hr_admin');
    app = testApp({ db });
    const employee = async () =>
      (
        await app!.inject({ method: 'GET', url: `/api/employees/${id}`, headers: { cookie } })
      ).json();
    const record = (body: object) =>
      app!.inject({
        method: 'POST',
        url: `/api/employees/${id}/salary-changes`,
        headers: { cookie },
        payload: body,
      });
    return { db, id, user, cookie, employee, record };
  }

  const rows = async (db: Db, id: number) =>
    (
      await db.$client.execute({
        sql: 'SELECT * FROM salary_changes WHERE employee_id = ? ORDER BY id',
        args: [id],
      })
    ).rows;

  it('records a merit raise: 201, one new history row, current-salary columns updated', async () => {
    const { db, id, user, employee, record } = await setup();
    const before = await employee();
    const raised = Math.round(before.salary.amountMinor * 1.03);

    const response = await record({
      effectiveDate: '2026-10-09',
      reason: 'merit',
      amount: { amountMinor: raised, currency: 'INR' },
      jobTitleId: SOFTWARE_ENGINEER,
      levelCode: 'L3',
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe(`/api/employees/${id}`);
    const body = response.json();
    expect(body.employee).toMatchObject({
      id,
      salary: { amountMinor: raised, currency: 'INR' },
      salaryEffectiveDate: '2026-10-09',
      level: { code: 'L3' },
      updatedAt: NOW,
    });
    expect(body.change).toMatchObject({
      effectiveDate: '2026-10-09',
      reason: 'merit',
      amount: { amountMinor: raised, currency: 'INR' },
      previousAmount: before.salary,
      changePct: changePct(before.salary.amountMinor, raised),
      jobTitle: { id: SOFTWARE_ENGINEER },
      level: { code: 'L3' },
      previousJobTitle: { id: SOFTWARE_ENGINEER },
      previousLevel: { code: 'L3' },
      changedBy: { displayName: user.displayName },
      createdAt: NOW,
    });
    const history = await rows(db, id);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      id: body.change.id,
      reason: 'merit',
      amount_minor: raised,
      changed_by_user_id: user.id,
      created_at: NOW,
    });
    expect(await currentSalaryMismatches(db)).toEqual([]);
  });

  it('records a promotion: the level changes, and the change shows the level before and after', async () => {
    const { db, id, employee, record } = await setup();
    const before = await employee();
    const raised = Math.round(before.salary.amountMinor * 1.2);

    const response = await record({
      effectiveDate: '2026-10-09',
      reason: 'promotion',
      amount: { amountMinor: raised, currency: 'INR' },
      jobTitleId: SOFTWARE_ENGINEER,
      levelCode: 'L4',
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.employee.level.code).toBe('L4');
    expect(body.change).toMatchObject({
      reason: 'promotion',
      level: { code: 'L4' },
      previousLevel: { code: 'L3' },
      previousJobTitle: { id: SOFTWARE_ENGINEER },
    });
    expect((await employee()).level.code).toBe('L4');
    expect(await rows(db, id)).toHaveLength(2);
    expect(await currentSalaryMismatches(db)).toEqual([]);
  });

  describe('rule violations', () => {
    // A merit raise of 3% for the employee in `setup`; each case overrides what it breaks.
    const merit = (salary: number, override: object = {}) => ({
      effectiveDate: '2026-10-09',
      reason: 'merit',
      amount: { amountMinor: Math.round(salary * 1.03), currency: 'INR' },
      jobTitleId: SOFTWARE_ENGINEER,
      levelCode: 'L3',
      ...override,
    });

    it.each([
      { code: 'DATE_IN_FUTURE', override: () => ({ effectiveDate: '2026-10-10' }) },
      { code: 'SALARY_DATE_BEFORE_CURRENT', override: () => ({ effectiveDate: '2022-01-09' }) },
      {
        code: 'SALARY_CURRENCY_MISMATCH',
        override: (salary: number) => ({ amount: { amountMinor: salary * 2, currency: 'USD' } }),
      },
      {
        code: 'RAISE_REQUIRED',
        override: (salary: number) => ({ amount: { amountMinor: salary, currency: 'INR' } }),
      },
      { code: 'POSITION_MUST_NOT_CHANGE', override: () => ({ levelCode: 'L4' }) },
      {
        code: 'PROMOTION_LEVEL_NOT_HIGHER',
        override: () => ({ reason: 'promotion', levelCode: 'L3' }),
      },
      {
        code: 'CORRECTION_NO_CHANGE',
        override: (salary: number) => ({
          reason: 'correction',
          amount: { amountMinor: salary, currency: 'INR' },
        }),
      },
    ])('returns 422 $code and keeps the data as it was', async ({ code, override }) => {
      const { db, id, employee, record } = await setup();
      const before = await employee();

      const response = await record(
        merit(before.salary.amountMinor, override(before.salary.amountMinor)),
      );

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code, status: 422 });
      expect(await employee()).toEqual(before);
      expect(await rows(db, id)).toHaveLength(1);
    });

    it('returns 422 NO_PAY_BAND when the new position has no band in the employee country', async () => {
      const reference = aReferenceSet().withoutBand('IN', SOFTWARE_ENGINEER, 'L4');
      const { db, id, employee, record } = await setup({ reference });
      const before = await employee();

      const response = await record(
        merit(before.salary.amountMinor, { reason: 'promotion', levelCode: 'L4' }),
      );

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        code: 'NO_PAY_BAND',
        detail: "There's no pay band for this country, job title and level.",
      });
      expect(await employee()).toEqual(before);
      expect(await rows(db, id)).toHaveLength(1);
    });

    it('returns 422 EMPLOYEE_TERMINATED for a terminated employee', async () => {
      const { db, id, employee, record } = await setup({ terminated: true });
      const before = await employee();

      const response = await record(merit(before.salary.amountMinor));

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'EMPLOYEE_TERMINATED', status: 422 });
      expect(await rows(db, id)).toHaveLength(1);
    });

    it('returns 404 EMPLOYEE_NOT_FOUND for an unknown employee', async () => {
      const { cookie } = await setup();

      const response = await app!.inject({
        method: 'POST',
        url: '/api/employees/9999/salary-changes',
        headers: { cookie },
        payload: merit(200_000_000),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'EMPLOYEE_NOT_FOUND', status: 404 });
    });
  });
});

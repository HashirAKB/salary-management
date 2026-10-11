import { changePct } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs } from '../../../test/builders/index.ts';
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
  async function setup() {
    const db = await testDb();
    const { id } = await anEmployee().insert(db);
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
    return { db, id, user, employee, record };
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
});

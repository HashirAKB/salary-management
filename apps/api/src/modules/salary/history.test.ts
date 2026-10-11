import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployee, loggedInAs, merit, promotion } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import { SOFTWARE_ENGINEER } from '../../seed/reference.ts';

describe('GET /api/employees/:id/salary-changes (S1)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // Hired 2022-01-10 at L3, merit +10% on 2023-04-01, promoted to L4 with +20% on 2024-04-01.
  async function setup() {
    const db = await testDb();
    const { id } = await anEmployee()
      .withSalary(200_000_000)
      .withHistory([merit('2023-04-01', 10), promotion('2024-04-01', 'L4', 20)])
      .insert(db);
    const { cookie, user } = await loggedInAs(db, 'hr_admin');
    app = testApp({ db });
    const history = (employeeId = id) =>
      app!.inject({
        method: 'GET',
        url: `/api/employees/${employeeId}/salary-changes`,
        headers: { cookie },
      });
    return { db, id, cookie, user, history };
  }

  it('lists newest first with previous amount, change % and the position before and after', async () => {
    const { history } = await setup();

    const response = await history();

    expect(response.statusCode).toBe(200);
    const { items } = response.json();
    expect(items.map((item: { reason: string }) => item.reason)).toEqual([
      'promotion',
      'merit',
      'hire',
    ]);
    expect(items[0]).toMatchObject({
      effectiveDate: '2024-04-01',
      amount: { amountMinor: 264_000_000, currency: 'INR' },
      previousAmount: { amountMinor: 220_000_000, currency: 'INR' },
      changePct: 20,
      jobTitle: { id: SOFTWARE_ENGINEER },
      level: { code: 'L4' },
      previousJobTitle: { id: SOFTWARE_ENGINEER },
      previousLevel: { code: 'L3' },
    });
    expect(items[1]).toMatchObject({
      previousAmount: { amountMinor: 200_000_000, currency: 'INR' },
      changePct: 10,
      level: { code: 'L3' },
      previousLevel: { code: 'L3' },
    });
    expect(items[2]).toMatchObject({
      effectiveDate: '2022-01-10',
      previousAmount: null,
      changePct: null,
      previousJobTitle: null,
      previousLevel: null,
    });
  });

  it('shows changedBy null for seeded rows and the recorder display name for rows made in the app', async () => {
    const { id, cookie, user, history } = await setup();
    await app!.inject({
      method: 'POST',
      url: `/api/employees/${id}/salary-changes`,
      headers: { cookie },
      payload: {
        effectiveDate: '2026-10-09',
        reason: 'merit',
        amount: { amountMinor: 270_000_000, currency: 'INR' },
        jobTitleId: SOFTWARE_ENGINEER,
        levelCode: 'L4',
      },
    });

    const { items } = (await history()).json();

    expect(items[0].changedBy).toEqual({ displayName: user.displayName });
    expect(items.slice(1).map((item: { changedBy: unknown }) => item.changedBy)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('orders two changes on the same date by id, the later one first, each against the one before', async () => {
    const { id, cookie, history } = await setup();
    const record = async (amountMinor: number) =>
      (
        await app!.inject({
          method: 'POST',
          url: `/api/employees/${id}/salary-changes`,
          headers: { cookie },
          payload: {
            effectiveDate: '2026-10-09',
            reason: 'merit',
            amount: { amountMinor, currency: 'INR' },
            jobTitleId: SOFTWARE_ENGINEER,
            levelCode: 'L4',
          },
        })
      ).json().change.id as number;
    const first = await record(270_000_000);
    const second = await record(280_000_000);

    const { items } = (await history()).json();

    expect(items.slice(0, 2).map((item: { id: number }) => item.id)).toEqual([second, first]);
    expect(items[0].previousAmount.amountMinor).toBe(270_000_000);
    expect(items[1].previousAmount.amountMinor).toBe(264_000_000);
  });

  it('returns 404 EMPLOYEE_NOT_FOUND for an unknown employee', async () => {
    const { history } = await setup();

    const response = await history(9999);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'EMPLOYEE_NOT_FOUND', status: 404 });
  });
});

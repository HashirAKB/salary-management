import type { EmployeeDetail, Role } from '@acme/shared';
import { changePct } from '@acme/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { anEmployeeDetail } from '../../../test/fixtures/employees.ts';
import { aSalaryChangeItem, aSalaryHistory } from '../../../test/fixtures/salary.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { aManualScheduler } from '../../../test/manualScheduler.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';
import { connection } from '../../api/connection.ts';

const problem = (status: number, body: Parameters<typeof aProblem>[0]) =>
  HttpResponse.json(aProblem(body), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

type User = ReturnType<typeof userEvent.setup>;

function servesEmployee(role: Role = 'hr_admin', employee: EmployeeDetail = anEmployeeDetail()) {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))),
    http.get('/api/employees/4217', () => HttpResponse.json(employee)),
  );
}

const renderDetail = () => render(<AppRoutes />, { route: '/employees/4217' });

const openModal = async (user: User) => {
  await user.click(await screen.findByRole('button', { name: 'Record salary change' }));
  return screen.findByRole('dialog', { name: 'Record salary change' });
};

async function choose(user: User, label: string, option: string) {
  await user.click(await screen.findByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('record salary change modal (04 section 8.5 S-6)', () => {
  it('offers the action to HR Admin on an active employee only', async () => {
    servesEmployee('hr_admin');
    const admin = renderDetail();
    expect(await screen.findByRole('button', { name: 'Record salary change' })).toBeVisible();
    admin.unmount();

    servesEmployee('hr_viewer');
    const viewer = renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Priya Nair' });
    expect(screen.queryByRole('button', { name: 'Record salary change' })).toBeNull();
    viewer.unmount();

    servesEmployee(
      'hr_admin',
      anEmployeeDetail({ status: 'terminated', terminationDate: '2026-10-01' }),
    );
    renderDetail();
    await screen.findByText(/^Terminated on/);
    expect(screen.queryByRole('button', { name: 'Record salary change' })).toBeNull();
  });

  it('locks title and level for merit and offers only higher levels for promotion', async () => {
    servesEmployee();
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openModal(user);
    await choose(user, 'Reason', 'Merit increase');
    expect(within(dialog).getByRole('combobox', { name: 'Job title' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Job title' })).toHaveValue(
      'Software Engineer',
    );
    expect(within(dialog).getByRole('combobox', { name: 'Level' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Level' })).toHaveValue('L3 Senior');

    await choose(user, 'Reason', 'Promotion');
    expect(within(dialog).getByRole('combobox', { name: 'Job title' })).toBeEnabled();
    const level = within(dialog).getByRole('combobox', { name: 'Level' });
    expect(level).toBeEnabled();
    await user.click(level);
    expect(await screen.findByRole('option', { name: 'L4 Staff' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'L2 Mid' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'L3 Senior' })).toBeNull();
  });

  it('defaults the date to today, and bounds it by today and the current salary date', async () => {
    servesEmployee();
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openModal(user);
    const date = within(dialog).getByLabelText('Effective date');
    expect(date).toHaveValue('2026-10-09');
    expect(date).toHaveAttribute('max', '2026-10-09');
    expect(date).toHaveAttribute('min', '2026-04-01');
  });

  it('shows RAISE_REQUIRED under the amount and PROMOTION_LEVEL_NOT_HIGHER under the level', async () => {
    servesEmployee();
    let code: 'RAISE_REQUIRED' | 'PROMOTION_LEVEL_NOT_HIGHER' = 'RAISE_REQUIRED';
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/employees/4217/salary-changes', async ({ request }) => {
        bodies.push(await request.json());
        return code === 'RAISE_REQUIRED'
          ? problem(422, { status: 422, code, detail: 'The new salary must be higher.' })
          : problem(422, { status: 422, code, detail: 'Choose a higher level.' });
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openModal(user);
    await choose(user, 'Reason', 'Promotion');
    await choose(user, 'Level', 'L4 Staff');
    await user.type(within(dialog).getByLabelText('New annual salary'), '1900000');
    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(await within(dialog).findByText('The new salary must be higher.')).toBeVisible();
    expect(within(dialog).getByLabelText('New annual salary')).toHaveAccessibleDescription(
      'The new salary must be higher.',
    );
    expect(bodies).toEqual([
      {
        effectiveDate: '2026-10-09',
        reason: 'promotion',
        amount: { amountMinor: 190000000, currency: 'INR' },
        jobTitleId: 1,
        levelCode: 'L4',
      },
    ]);

    code = 'PROMOTION_LEVEL_NOT_HIGHER';
    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));
    expect(await within(dialog).findByText('Choose a higher level.')).toBeVisible();
    expect(within(dialog).getByRole('combobox', { name: 'Level' })).toHaveAccessibleDescription(
      'Choose a higher level.',
    );
  });
});

const servesBand = () =>
  server.use(
    http.get('/api/pay-bands/IN/1/L3', () =>
      HttpResponse.json({
        countryCode: 'IN',
        jobTitleId: 1,
        levelCode: 'L3',
        min: { amountMinor: 160000000, currency: 'INR' },
        mid: { amountMinor: 204000000, currency: 'INR' },
        max: { amountMinor: 250000000, currency: 'INR' },
      }),
    ),
  );

/** A merit raise from INR 19,80,000 to INR 20,00,000; GETs then serve the recorded state. */
function servesMeritRaise() {
  const raised = anEmployeeDetail({ salary: { amountMinor: 200000000, currency: 'INR' } });
  const change = aSalaryChangeItem({
    id: 4,
    effectiveDate: '2026-10-09',
    reason: 'merit',
    amount: { amountMinor: 200000000, currency: 'INR' },
    previousAmount: { amountMinor: 198000000, currency: 'INR' },
    changePct: changePct(198000000, 200000000),
    level: { code: 'L3', name: 'Senior' },
    previousJobTitle: { id: 1, name: 'Software Engineer' },
    previousLevel: { code: 'L3', name: 'Senior' },
    changedBy: { displayName: 'HR Admin (demo)' },
  });
  const state = { recorded: false };
  server.use(
    http.get('/api/employees/4217', () =>
      HttpResponse.json(state.recorded ? raised : anEmployeeDetail()),
    ),
    http.get('/api/employees/4217/salary-changes', () =>
      HttpResponse.json(aSalaryHistory(state.recorded ? [change] : [])),
    ),
    http.post('/api/employees/4217/salary-changes', () => {
      state.recorded = true;
      return HttpResponse.json(
        { employee: raised, change },
        { status: 201, headers: { Location: '/api/employees/4217' } },
      );
    }),
  );
}

async function fillMerit(user: User, dialog: HTMLElement) {
  await choose(user, 'Reason', 'Merit increase');
  await user.type(within(dialog).getByLabelText('New annual salary'), '2000000');
}

describe('record salary change outcomes and preview (04 sections 8.5 S-6, 8.6)', () => {
  it('closes the modal, refreshes the history and toasts after a success', async () => {
    servesEmployee();
    servesMeritRaise();
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openModal(user);
    await fillMerit(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(await screen.findByText('Salary change recorded.')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const history = await screen.findByRole('region', { name: 'Salary history' });
    expect(await within(history).findByText('Merit increase')).toBeVisible();
    const salary = screen.getByRole('region', { name: 'Salary' });
    expect(within(salary).getByText('INR 20,00,000')).toBeVisible();
  });

  it('closes, refreshes and toasts the detail on EMPLOYEE_TERMINATED', async () => {
    const state = { current: anEmployeeDetail() };
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(aMeResponse('hr_admin'))),
      http.get('/api/employees/4217', () => HttpResponse.json(state.current)),
      http.post('/api/employees/4217/salary-changes', () => {
        state.current = anEmployeeDetail({ status: 'terminated', terminationDate: '2026-10-08' });
        return problem(422, {
          status: 422,
          code: 'EMPLOYEE_TERMINATED',
          detail: "A terminated employee's salary can't be changed.",
        });
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openModal(user);
    await fillMerit(user, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(
      await screen.findByText("A terminated employee's salary can't be changed."),
    ).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText(/^Terminated on 8 Oct 2026/)).toBeVisible();
  });

  it('previews the same change % that the history row shows for the same amounts', async () => {
    servesEmployee();
    servesMeritRaise();
    servesBand();
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openModal(user);
    await fillMerit(user, dialog);

    const preview = await within(dialog).findByRole('group', { name: 'Preview' });
    expect(preview).toHaveTextContent('INR 19,80,000 to INR 20,00,000');
    expect(within(preview).getByText('+1.0%')).toBeVisible();
    expect(await within(preview).findByText('New compa-ratio 0.98')).toBeVisible();
    expect(within(preview).getByText('Inside band')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));
    const history = await screen.findByRole('region', { name: 'Salary history' });
    const row = (await within(history).findByText('Merit increase')).closest('tr')!;
    expect(within(row).getByText('+1.0%')).toBeVisible();
  });
});

describe('record salary change on a waking server (05 section 5.9 C row 4; D-045)', () => {
  afterEach(() => connection.reset());

  it('does not retry the write and says the change may not have been saved', async () => {
    connection.setScheduler(aManualScheduler());
    servesEmployee();
    servesBand();
    let posts = 0;
    server.use(
      http.post('/api/employees/4217/salary-changes', () => {
        posts += 1;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openModal(user);
    await choose(user, 'Reason', 'Merit increase');
    await user.type(within(dialog).getByLabelText('New annual salary'), '2000000');
    await user.click(within(dialog).getByRole('button', { name: 'Record change' }));

    expect(
      await within(dialog).findByText(
        'The server was waking up, so your change may not have been saved. Check the page and try again.',
      ),
    ).toBeVisible();
    expect(posts).toBe(1);
  });
});

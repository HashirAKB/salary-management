import type { EmployeeDetail, Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { anEmployeeDetail } from '../../../test/fixtures/employees.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

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
    expect(within(dialog).getByLabelText('Job title')).toBeDisabled();
    expect(within(dialog).getByLabelText('Job title')).toHaveValue('Software Engineer');
    expect(within(dialog).getByLabelText('Level')).toBeDisabled();
    expect(within(dialog).getByLabelText('Level')).toHaveValue('L3 Senior');

    await choose(user, 'Reason', 'Promotion');
    expect(within(dialog).getByLabelText('Job title')).toBeEnabled();
    const level = within(dialog).getByLabelText('Level');
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
    expect(within(dialog).getByLabelText('Level')).toHaveAccessibleDescription(
      'Choose a higher level.',
    );
  });
});

import type { EmployeeDetail } from '@acme/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

/** Serves the employee and lets a write replace what the next GET returns. */
function servesEmployee(initial: EmployeeDetail = anEmployeeDetail()) {
  const state = { current: initial };
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(aMeResponse('hr_admin'))),
    http.get('/api/employees/4217', () => HttpResponse.json(state.current)),
  );
  return state;
}

const renderDetail = () => render(<AppRoutes />, { route: '/employees/4217' });

const openEdit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Edit details' }));
  return screen.findByRole('dialog', { name: 'Edit details' });
};

const openTerminate = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Terminate' }));
  return screen.findByRole('dialog', { name: 'Terminate employee' });
};

describe('edit details modal (04 section 8.5 S-5)', () => {
  it('keeps Save disabled until a field changes', async () => {
    servesEmployee();
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openEdit(user);
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(within(dialog).getByLabelText('First name')).toHaveValue('Priya');
    expect(within(dialog).getByLabelText('Last name')).toHaveValue('Nair');
    expect(
      within(dialog).getByText('Change title or level by recording a salary change.'),
    ).toBeVisible();
    expect(save).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Last name'), 'x');
    expect(save).toBeEnabled();

    await user.type(within(dialog).getByLabelText('Last name'), '{Backspace}');
    expect(save).toBeDisabled();
  });

  it('saving the edit modal updates the page and shows "Details updated."', async () => {
    const state = servesEmployee();
    const bodies: unknown[] = [];
    server.use(
      http.patch('/api/employees/4217', async ({ request }) => {
        bodies.push(await request.json());
        state.current = anEmployeeDetail({ lastName: 'Rao' });
        return HttpResponse.json(state.current);
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openEdit(user);
    const last = within(dialog).getByLabelText('Last name');
    await user.clear(last);
    await user.type(last, 'Rao');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Rao' })).toBeVisible();
    expect(await screen.findByText('Details updated.')).toBeVisible();
    expect(bodies).toEqual([{ lastName: 'Rao' }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('terminate modal (04 section 8.5 S-7)', () => {
  it('terminating from the modal shows the terminated banner', async () => {
    const state = servesEmployee();
    const bodies: unknown[] = [];
    server.use(
      http.post('/api/employees/4217/termination', async ({ request }) => {
        bodies.push(await request.json());
        state.current = anEmployeeDetail({ status: 'terminated', terminationDate: '2026-10-09' });
        return HttpResponse.json(state.current);
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openTerminate(user);
    expect(
      within(dialog).getByText(
        "Terminating removes Priya Nair from current insights. Their record and salary history are kept. This can't be undone in this version.",
      ),
    ).toBeVisible();
    const date = within(dialog).getByLabelText('Termination date');
    expect(date).toHaveValue('2026-10-09');
    expect(date).toHaveAttribute('max', '2026-10-09');
    expect(date).toHaveAttribute('min', '2021-07-12');
    await user.click(within(dialog).getByRole('button', { name: 'Terminate' }));

    expect(
      await screen.findByText(
        'Terminated on 9 Oct 2026. Excluded from current insights. History is kept.',
      ),
    ).toBeVisible();
    expect(bodies).toEqual([{ terminationDate: '2026-10-09' }]);
    expect(screen.queryByRole('button', { name: 'Terminate' })).toBeNull();
  });

  it('shows TERMINATION_BEFORE_HIRE under the date and closes on EMPLOYEE_ALREADY_TERMINATED with a toast', async () => {
    const state = servesEmployee();
    let code: 'TERMINATION_BEFORE_HIRE' | 'EMPLOYEE_ALREADY_TERMINATED' = 'TERMINATION_BEFORE_HIRE';
    server.use(
      http.post('/api/employees/4217/termination', () =>
        code === 'TERMINATION_BEFORE_HIRE'
          ? problem(422, {
              status: 422,
              code,
              detail: "The termination date can't be before the hire date.",
            })
          : problem(422, {
              status: 422,
              code,
              detail: 'This employee is already terminated.',
            }),
      ),
    );
    const user = userEvent.setup();
    renderDetail();

    const dialog = await openTerminate(user);
    fireEvent.change(within(dialog).getByLabelText('Termination date'), {
      target: { value: '2021-01-01' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Terminate' }));
    expect(
      await within(dialog).findByText("The termination date can't be before the hire date."),
    ).toBeVisible();

    code = 'EMPLOYEE_ALREADY_TERMINATED';
    state.current = anEmployeeDetail({ status: 'terminated', terminationDate: '2026-10-08' });
    await user.click(within(dialog).getByRole('button', { name: 'Terminate' }));

    expect(await screen.findByText('This employee is already terminated.')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      await screen.findByText(
        'Terminated on 8 Oct 2026. Excluded from current insights. History is kept.',
      ),
    ).toBeVisible();
  });
});

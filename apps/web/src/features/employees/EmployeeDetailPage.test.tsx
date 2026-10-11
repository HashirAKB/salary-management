import type { Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { anEmployeeDetail } from '../../../test/fixtures/employees.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const loggedInAs = (role: Role) =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))));

const servesEmployee = (employee = anEmployeeDetail()) =>
  server.use(http.get('/api/employees/4217', () => HttpResponse.json(employee)));

const renderDetail = () => render(<AppRoutes />, { route: '/employees/4217' });

describe('employee detail page (04 section 8.5 S-3)', () => {
  it('shows the header, salary card with band bar and compa-ratio, and details card', async () => {
    loggedInAs('hr_viewer');
    server.use(
      http.get('/api/employees/4217', async () => {
        await delay(50);
        return HttpResponse.json(anEmployeeDetail());
      }),
    );
    renderDetail();

    expect(await screen.findByLabelText('Loading employee')).toBeVisible();
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Nair' })).toBeVisible();
    expect(screen.getByText('E004217')).toBeVisible();
    expect(screen.getByText('Active')).toBeVisible();
    expect(screen.getByText('Software Engineer, L3 Senior, India')).toBeVisible();
    expect(screen.getByText('Hired 12 Jul 2021')).toBeVisible();

    const salary = screen.getByRole('region', { name: 'Salary' });
    expect(within(salary).getByText('INR 19,80,000')).toBeVisible();
    expect(within(salary).getByText('USD 22,770')).toBeVisible();
    expect(within(salary).getByText('Effective 1 Apr 2026')).toBeVisible();
    const band = within(salary).getByRole('group', { name: 'Pay band' });
    expect(within(band).getByText('INR 16,00,000')).toBeVisible();
    expect(within(band).getByText('INR 20,40,000')).toBeVisible();
    expect(within(band).getByText('INR 25,00,000')).toBeVisible();
    expect(within(salary).getByText('Compa-ratio 0.97')).toBeVisible();
    expect(within(salary).queryByText(/(below|above) band/i)).toBeNull();

    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('Priya')).toBeVisible();
    expect(within(details).getByText('Nair')).toBeVisible();
    expect(within(details).getByText('Female')).toBeVisible();
    expect(within(details).getByText('India')).toBeVisible();
    expect(within(details).getByText('Engineering')).toBeVisible();
  });

  it('says "Below band" outside the band', async () => {
    loggedInAs('hr_viewer');
    servesEmployee(anEmployeeDetail({ bandPosition: 'below', compaRatio: 0.7 }));
    renderDetail();

    const salary = await screen.findByRole('region', { name: 'Salary' });
    expect(within(salary).getByText('Below band')).toBeVisible();
  });

  it('shows Edit details and Terminate to HR Admin and no actions to HR Viewer', async () => {
    loggedInAs('hr_admin');
    servesEmployee();
    const admin = renderDetail();

    expect(await screen.findByRole('button', { name: 'Edit details' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Terminate' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Record salary change' })).toBeVisible();
    admin.unmount();

    loggedInAs('hr_viewer');
    renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Priya Nair' });
    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Terminate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Record salary change' })).toBeNull();
  });

  it('shows "Employee not found." for an unknown id', async () => {
    loggedInAs('hr_admin');
    server.use(
      http.get('/api/employees/4217', () =>
        HttpResponse.json(aProblem({ status: 404, code: 'EMPLOYEE_NOT_FOUND' }), {
          status: 404,
          headers: { 'content-type': 'application/problem+json' },
        }),
      ),
    );
    renderDetail();

    expect(await screen.findByText('Employee not found.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to employees' })).toHaveAttribute(
      'href',
      '/employees',
    );
  });

  it('shows "Employee not found." when the id is not a valid id', async () => {
    loggedInAs('hr_admin');
    server.use(
      http.get('/api/employees/4217', () =>
        HttpResponse.json(
          aProblem({
            status: 400,
            code: 'VALIDATION_FAILED',
            errors: [{ path: 'id', message: 'Invalid input' }],
          }),
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderDetail();

    expect(await screen.findByText('Employee not found.')).toBeVisible();
  });

  it('shows the error alert with "Retry" on a 500 problem', async () => {
    loggedInAs('hr_admin');
    server.use(
      http.get('/api/employees/4217', () =>
        HttpResponse.json(
          aProblem({ status: 500, code: 'INTERNAL', detail: 'The server hit a snag.' }),
          { status: 500, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderDetail();

    expect(await screen.findByText('The server hit a snag.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  it('a terminated employee\'s page shows the banner and only "Edit details"', async () => {
    loggedInAs('hr_admin');
    servesEmployee(anEmployeeDetail({ status: 'terminated', terminationDate: '2026-10-09' }));
    renderDetail();

    expect(
      await screen.findByText(
        'Terminated on 9 Oct 2026. Excluded from current insights. History is kept.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Terminated')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Terminate' })).toBeNull();
  });
});

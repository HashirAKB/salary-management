import type { Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  anEmployeeListItem,
  anEmployeeListResponse,
  someEmployees,
} from '../../../test/fixtures/employees.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const loggedInAs = (role: Role) =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))));

describe('employee list page (04 section 8.5)', () => {
  it('renders the rows and the "Showing 1 to 50 of N" line', async () => {
    loggedInAs('hr_viewer');
    server.use(
      http.get('/api/employees', () =>
        HttpResponse.json(
          anEmployeeListResponse({
            items: [
              anEmployeeListItem(),
              anEmployeeListItem({
                id: 4218,
                employeeCode: 'E004218',
                firstName: 'Tom',
                lastName: 'Okafor',
                status: 'terminated',
                terminationDate: '2026-03-01',
                bandPosition: 'above',
              }),
              ...someEmployees(48, 1),
            ],
            total: 2431,
            totalPages: 49,
          }),
        ),
      ),
    );

    render(<AppRoutes />, { route: '/employees' });

    expect(await screen.findByText('Showing 1 to 50 of 2,431 employees')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /E004217/ });
    expect(within(row).getByText('Priya Nair')).toBeInTheDocument();
    expect(within(row).getByText('India')).toBeInTheDocument();
    expect(within(row).getByText('Software Engineer')).toBeInTheDocument();
    expect(within(row).getByText('L3 Senior')).toBeInTheDocument();
    expect(within(row).getByText('INR 19,80,000')).toBeInTheDocument();
    expect(within(row).getByText('USD 22,770')).toBeInTheDocument();
    expect(within(row).getByText('Inside')).toBeInTheDocument();
    expect(within(row).getByText('12 Jul 2021')).toBeInTheDocument();
    expect(within(row).queryByText('Terminated')).not.toBeInTheDocument();
    const terminated = screen.getByRole('row', { name: /E004218/ });
    expect(within(terminated).getByText('Above')).toBeInTheDocument();
    expect(within(terminated).getByText('Terminated')).toBeInTheDocument();
    expect(screen.getByText('FX as of 30 Sep 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '49' })).toBeInTheDocument();
  });

  it('shows 10 skeleton rows on first load', async () => {
    loggedInAs('hr_viewer');
    server.use(
      http.get('/api/employees', async () => {
        await delay('infinite');
        return HttpResponse.json(anEmployeeListResponse());
      }),
    );

    render(<AppRoutes />, { route: '/employees' });

    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByRole('heading', { level: 1, name: 'Employees' })).toBeInTheDocument();
  });
});

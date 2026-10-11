import type { Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  anEmployeeListItem,
  anEmployeeListResponse,
  someEmployees,
} from '../../../test/fixtures/employees.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const Location = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="location">{pathname + search}</output>;
};

const renderList = (route: string) =>
  render(
    <>
      <AppRoutes />
      <Location />
    </>,
    { route },
  );

/** Serves 120 employees in pages of the requested size; records each request's query. */
function servesPages(requests: URLSearchParams[]) {
  server.use(
    http.get('/api/employees', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const page = Number(params.get('page'));
      const pageSize = Number(params.get('pageSize'));
      const totalPages = Math.ceil(120 / pageSize);
      const first = (page - 1) * pageSize;
      return HttpResponse.json(
        anEmployeeListResponse({
          items: page > totalPages ? [] : someEmployees(Math.min(pageSize, 120 - first), first + 1),
          page,
          pageSize,
          total: 120,
          totalPages,
        }),
      );
    }),
  );
}

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

  it.each(['hr_admin', 'hr_viewer'] as const)(
    'opens the employee detail page from a row link for %s (04 section 8.5)',
    async (role) => {
      loggedInAs(role);
      server.use(
        http.get('/api/employees', () =>
          HttpResponse.json(anEmployeeListResponse({ items: [anEmployeeListItem()] })),
        ),
      );
      const user = userEvent.setup();
      renderList('/employees');

      const link = await screen.findByRole('link', { name: 'Priya Nair' });
      expect(link).toHaveAttribute('href', '/employees/4217');
      await user.click(link);

      expect(screen.getByLabelText('location')).toHaveTextContent('/employees/4217');
    },
  );

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

  it('changing the page or page size updates the URL and requests that page', async () => {
    loggedInAs('hr_viewer');
    const requests: URLSearchParams[] = [];
    servesPages(requests);
    const user = userEvent.setup();
    renderList('/employees');
    await screen.findByText('Showing 1 to 50 of 120 employees');
    expect(screen.getByLabelText('location')).toHaveTextContent(/^\/employees$/);

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(await screen.findByText('Showing 51 to 100 of 120 employees')).toBeInTheDocument();
    expect(screen.getByLabelText('location')).toHaveTextContent('/employees?page=2');
    expect(requests.at(-1)?.get('page')).toBe('2');

    await user.click(screen.getByRole('combobox', { name: 'Page size' }));
    await user.click(await screen.findByRole('option', { name: '25' }));

    expect(await screen.findByText('Showing 1 to 25 of 120 employees')).toBeInTheDocument();
    expect(screen.getByLabelText('location')).toHaveTextContent('/employees?pageSize=25');
    expect(requests.at(-1)?.get('page')).toBe('1');
    expect(requests.at(-1)?.get('pageSize')).toBe('25');
  });

  it('dims the previous rows and shows a progress bar while the next page loads', async () => {
    loggedInAs('hr_viewer');
    server.use(
      http.get('/api/employees', async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        if (page === 2) await delay(150);
        return HttpResponse.json(
          anEmployeeListResponse({
            items: someEmployees(50, (page - 1) * 50 + 1),
            page,
            pageSize: 50,
            total: 120,
            totalPages: 3,
          }),
        );
      }),
    );
    const user = userEvent.setup();
    renderList('/employees');
    await screen.findByText('Showing 1 to 50 of 120 employees');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 to 50 of 120 employees')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAttribute('data-fetching', 'true');

    expect(await screen.findByText('Showing 51 to 100 of 120 employees')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).not.toHaveAttribute('data-fetching');
  });

  it('reads the page and page size from the URL', async () => {
    loggedInAs('hr_viewer');
    const requests: URLSearchParams[] = [];
    servesPages(requests);
    renderList('/employees?page=2&pageSize=100');

    expect(await screen.findByText('Showing 101 to 120 of 120 employees')).toBeInTheDocument();
    expect(requests[0]?.get('page')).toBe('2');
    expect(requests[0]?.get('pageSize')).toBe('100');
  });

  it('shows the past-the-end notice with a link to the last page', async () => {
    loggedInAs('hr_viewer');
    const requests: URLSearchParams[] = [];
    servesPages(requests);
    const user = userEvent.setup();
    renderList('/employees?page=9');

    expect(
      await screen.findByText('This page is past the end of the results.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to last page' }));

    expect(await screen.findByText('Showing 101 to 120 of 120 employees')).toBeInTheDocument();
    expect(screen.getByLabelText('location')).toHaveTextContent('/employees?page=3');
    expect(screen.queryByText('This page is past the end of the results.')).not.toBeInTheDocument();
  });

  it('shows the error alert with "Retry" on a 500 problem', async () => {
    loggedInAs('hr_viewer');
    let calls = 0;
    server.use(
      http.get('/api/employees', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              aProblem({ status: 500, code: 'INTERNAL', detail: 'The server hit a snag.' }),
              { status: 500, headers: { 'content-type': 'application/problem+json' } },
            )
          : HttpResponse.json(anEmployeeListResponse());
      }),
    );
    const user = userEvent.setup();
    render(<AppRoutes />, { route: '/employees' });

    expect(await screen.findByRole('alert')).toHaveTextContent('The server hit a snag.');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Priya Nair')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows "No employees yet." with "Add employee" for HR Admin', async () => {
    loggedInAs('hr_admin');
    server.use(
      http.get('/api/employees', () =>
        HttpResponse.json(anEmployeeListResponse({ items: [], total: 0, totalPages: 0 })),
      ),
    );
    render(<AppRoutes />, { route: '/employees' });

    expect(await screen.findByText('No employees yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add employee' })).toHaveLength(1);
    expect(screen.queryByText('This page is past the end of the results.')).not.toBeInTheDocument();
  });

  it('keeps "Add employee" and drops the "Showing" line when filters match nobody', async () => {
    loggedInAs('hr_admin');
    server.use(
      http.get('/api/employees', () =>
        HttpResponse.json(anEmployeeListResponse({ items: [], total: 0, totalPages: 0 })),
      ),
    );
    render(<AppRoutes />, { route: '/employees?q=zzzz' });

    expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add employee' })).toHaveLength(1);
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });

  it.each<[Role, boolean]>([
    ['hr_admin', true],
    ['hr_viewer', false],
  ])('shows "Add employee" to HR Admin only (%s)', async (role, shown) => {
    loggedInAs(role);
    server.use(http.get('/api/employees', () => HttpResponse.json(anEmployeeListResponse())));
    render(<AppRoutes />, { route: '/employees' });
    await screen.findByText('Priya Nair');

    const link = screen.queryByRole('link', { name: 'Add employee' });

    if (shown) expect(link).toHaveAttribute('href', '/employees/new');
    else expect(link).not.toBeInTheDocument();
  });
});

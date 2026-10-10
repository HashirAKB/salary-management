import type { Role } from '@acme/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anEmployeeListResponse } from '../../../test/fixtures/employees.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const loggedInAs = (role: Role) =>
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))),
    http.get('/api/employees', () => HttpResponse.json(anEmployeeListResponse())),
  );

describe('export CSV button (04 sections 5.7 and 8.5)', () => {
  const createObjectURL = vi.fn(() => 'blob:employees');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });
  afterEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it.each<Role>(['hr_admin', 'hr_viewer'])('shows "Export CSV" to %s', async (role) => {
    loggedInAs(role);
    render(<AppRoutes />, { route: '/employees' });
    await screen.findByText('Priya Nair');

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('requests the current filters and shows a spinner until the file arrives', async () => {
    loggedInAs('hr_admin');
    const requests: URLSearchParams[] = [];
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/exports/employees.csv', async ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        await released;
        return new HttpResponse('﻿"Employee ID"\r\n', {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="employees-2026-10-09.csv"',
          },
        });
      }),
    );
    render(<AppRoutes />, { route: '/employees?country=IN&status=all&sort=salaryUsd&page=2' });
    await screen.findByText('Priya Nair');

    await userEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));

    const exporting = await screen.findByRole('button', { name: 'Export CSV' });
    expect(exporting).toBeDisabled();
    expect(exporting).toHaveAttribute('data-loading', 'true');
    release();
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(requests).toHaveLength(1);
    expect(Object.fromEntries(requests[0] ?? [])).toEqual({
      country: 'IN',
      status: 'all',
      sort: 'salaryUsd',
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
  });

  it('shows an alert with "Retry" when the export fails, and retrying downloads the file', async () => {
    loggedInAs('hr_admin');
    let calls = 0;
    server.use(
      http.get('/api/exports/employees.csv', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              aProblem({ status: 500, code: 'INTERNAL', detail: 'The export hit a snag.' }),
              { status: 500, headers: { 'content-type': 'application/problem+json' } },
            )
          : new HttpResponse('"Employee ID"\r\n', {
              headers: { 'content-disposition': 'attachment; filename="employees-2026-10-09.csv"' },
            });
      }),
    );
    const user = userEvent.setup();
    render(<AppRoutes />, { route: '/employees' });
    await screen.findByText('Priya Nair');

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The export hit a snag.');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});

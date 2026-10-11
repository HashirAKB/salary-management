import type { PayDistributionResponse, Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aDistributionResponse, aSummaryResponse } from '../../../test/fixtures/insights.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const Location = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="location">{pathname + search}</output>;
};

const renderInsights = (route = '/insights') =>
  render(
    <>
      <AppRoutes />
      <Location />
    </>,
    { route },
  );

/** Serves the summary and the distribution; records each distribution request's query. */
function servesInsights(
  role: Role,
  distribution: (groupBy: string) => PayDistributionResponse = () => aDistributionResponse(),
  requests: URLSearchParams[] = [],
) {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))),
    http.get('/api/insights/summary', () => HttpResponse.json(aSummaryResponse())),
    http.get('/api/insights/pay-distribution', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return HttpResponse.json(distribution(params.get('groupBy') ?? 'country'));
    }),
  );
}

describe('insights page (04 section 8.5, S-8)', () => {
  it('shows "Hidden to protect small groups" on a suppressed row', async () => {
    servesInsights('finance');

    renderInsights();

    const table = await screen.findByRole('table', { name: 'Pay distribution' });
    const row = within(table).getByRole('row', { name: /India/ });
    expect(within(row).getByText('Hidden to protect small groups')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /United States/ })).not.toHaveTextContent(
      'Hidden to protect small groups',
    );
  });

  it.each<Role>(['hr_admin', 'hr_viewer'])(
    'links the outside-band and stale cards to the employee list for %s',
    async (role) => {
      servesInsights(role);

      renderInsights();

      const band = await screen.findByRole('link', { name: /Paid outside band/ });
      expect(band).toHaveAttribute('href', '/employees?band=outside');
      expect(band).toHaveTextContent('560');
      expect(band).toHaveTextContent('281 below, 279 above');
      const stale = screen.getByRole('link', { name: /No salary change since 9 Oct 2024/ });
      expect(stale).toHaveAttribute('href', '/employees?salaryUnchangedSince=2024-10-09');
      expect(stale).toHaveTextContent('1,234');
    },
  );

  it('shows Finance the same two counts as plain text, not links', async () => {
    servesInsights('finance');

    renderInsights();

    expect(await screen.findByText('Paid outside band')).toBeInTheDocument();
    expect(screen.getByText('560')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Paid outside band/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /No salary change since/ })).not.toBeInTheDocument();
  });

  it('shows each country its share of payroll: 0.0% for a tiny one, n/a for a hidden one', async () => {
    servesInsights('finance');

    renderInsights();

    const table = await screen.findByRole('table', { name: 'Payroll by country' });
    const us = within(table).getByRole('row', { name: /United States/ });
    expect(within(us).getByText('99.0%')).toBeInTheDocument();
    const germany = within(table).getByRole('row', { name: /Germany/ });
    expect(within(germany).getByText('0.0%')).toBeInTheDocument();
    const india = within(table).getByRole('row', { name: /India/ });
    expect(within(india).getByText('n/a')).toBeInTheDocument();
    expect(within(india).getByText('Hidden to protect small groups')).toBeInTheDocument();
  });

  it('changing "Group by" updates the URL, the request and the table', async () => {
    const requests: URLSearchParams[] = [];
    servesInsights(
      'hr_admin',
      (groupBy) =>
        groupBy === 'department'
          ? aDistributionResponse({
              groupBy: 'department',
              groups: [
                {
                  ...aDistributionResponse().groups[0]!,
                  key: '1',
                  label: 'Engineering',
                },
              ],
            })
          : aDistributionResponse(),
      requests,
    );
    renderInsights();
    const table = await screen.findByRole('table', { name: 'Pay distribution' });
    expect(within(table).getByRole('row', { name: /United States/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Department' }));

    expect(await within(table).findByRole('row', { name: /Engineering/ })).toBeInTheDocument();
    expect(screen.getByLabelText('location')).toHaveTextContent('/insights?groupBy=department');
    expect(requests.at(-1)?.get('groupBy')).toBe('department');
  });

  it('sends the filters in the URL with the distribution request', async () => {
    const requests: URLSearchParams[] = [];
    servesInsights('hr_admin', () => aDistributionResponse(), requests);

    renderInsights('/insights?country=IN,US&level=L3');

    await screen.findByRole('table', { name: 'Pay distribution' });
    expect(requests.at(-1)?.get('country')).toBe('IN,US');
    expect(requests.at(-1)?.get('level')).toBe('L3');
    expect(requests.at(-1)?.get('groupBy')).toBe('country');
  });
});

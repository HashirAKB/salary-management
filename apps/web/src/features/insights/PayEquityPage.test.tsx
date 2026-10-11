import type { PayEquityResponse, Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { aPayEquityResponse } from '../../../test/fixtures/insights.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const Location = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="location">{pathname + search}</output>;
};

const renderPayEquity = (route = '/insights/pay-equity') =>
  render(
    <>
      <AppRoutes />
      <Location />
    </>,
    { route },
  );

/** Serves one pay equity body; records each request's query. */
function servesPayEquity(
  body: PayEquityResponse = aPayEquityResponse(),
  requests: URLSearchParams[] = [],
  role: Role = 'hr_admin',
) {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))),
    http.get('/api/insights/pay-equity', ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json(body);
    }),
  );
}

describe('pay equity page (04 section 8.5, S-9)', () => {
  it('shows "Too few to compare" rows and a "Review" badge with text on flagged rows', async () => {
    servesPayEquity();

    renderPayEquity('/insights/pay-equity?includeNotComparable=true');

    const table = await screen.findByRole('table', { name: 'Pay equity cohorts' });
    const flagged = within(table).getByRole('row', { name: /Software Engineer/ });
    expect(within(flagged).getByText('Review')).toBeInTheDocument();
    expect(within(flagged).getByText('6.7%')).toBeInTheDocument();
    expect(within(flagged).getByText('USD 140,000')).toBeInTheDocument();
    const notComparable = within(table).getByRole('row', { name: /Product Designer/ });
    expect(within(notComparable).getByText('Too few to compare')).toBeInTheDocument();
    expect(within(notComparable).queryByText('Review')).not.toBeInTheDocument();
    expect(
      screen.getByText('171 of 250 cohorts can be compared; 3 are flagged.'),
    ).toBeInTheDocument();
  });

  it('shows a gap that rounds to zero as 0.0%, and a missing org gap as too few to compare', async () => {
    const body = aPayEquityResponse();
    servesPayEquity({
      ...body,
      org: { ...body.org, meanGapPct: 0, medianGapPct: null },
      cohorts: [{ ...body.cohorts[0]!, gapPct: 0, flagged: false }],
    });

    renderPayEquity();

    const mean = (await screen.findByText('Mean gap (unadjusted)')).closest('div')!;
    expect(within(mean).getByText('0.0%')).toBeInTheDocument();
    const median = screen.getByText('Median gap (unadjusted)').closest('div')!;
    expect(within(median).getByText('Too few to compare')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Software Engineer/ });
    expect(within(row).getByText('0.0%')).toBeInTheDocument();
    expect(within(row).queryByText('Review')).not.toBeInTheDocument();
  });

  it('puts the filters in the URL and the request', async () => {
    const requests: URLSearchParams[] = [];
    servesPayEquity(aPayEquityResponse(), requests);
    renderPayEquity('/insights/pay-equity?country=US&flaggedOnly=true');
    await screen.findByRole('table', { name: 'Pay equity cohorts' });
    expect(requests.at(-1)?.get('country')).toBe('US');
    expect(requests.at(-1)?.get('flaggedOnly')).toBe('true');
    expect(requests.at(-1)?.get('includeNotComparable')).toBe('false');

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Show cohorts too small to compare' }),
    );

    expect(screen.getByLabelText('location')).toHaveTextContent(
      '/insights/pay-equity?country=US&flaggedOnly=true&includeNotComparable=true',
    );
    await screen.findByRole('table', { name: 'Pay equity cohorts' });
    expect(requests.at(-1)?.get('includeNotComparable')).toBe('true');
  });

  it('says so when no cohorts match', async () => {
    servesPayEquity({ ...aPayEquityResponse(), cohorts: [] });

    renderPayEquity();

    expect(await screen.findByText('No cohorts match these filters.')).toBeInTheDocument();
  });
});

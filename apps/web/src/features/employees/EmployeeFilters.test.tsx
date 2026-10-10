import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation, useNavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';
import { anEmployeeListResponse, someEmployees } from '../../../test/fixtures/employees.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const Location = () => {
  const { pathname, search } = useLocation();
  return (
    <output aria-label="location" data-navigation={useNavigationType()}>
      {pathname + search}
    </output>
  );
};

// The dropdown options stay mounted, so a chosen value's name also appears there.
const pill = (name: string) => screen.queryByText(name, { selector: '[class*="Pill-label"]' });
const findPill = (name: string) => screen.findByText(name, { selector: '[class*="Pill-label"]' });

// A Mantine select's dropdown list carries the same label as its input.
const field = (label: string) =>
  screen.getAllByLabelText(label).find((element) => element.tagName === 'INPUT')!;

const renderList = (route: string) =>
  render(
    <>
      <AppRoutes />
      <Location />
    </>,
    { route },
  );

/** Serves 120 employees whatever the query is; records each request's query. */
function servesEmployees(requests: URLSearchParams[]) {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(aMeResponse('hr_viewer'))),
    http.get('/api/employees', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return HttpResponse.json(
        anEmployeeListResponse({
          // Not India or the United States, so those names only appear in the filter bar.
          items: someEmployees(50).map((e) => ({ ...e, country: { code: 'DE', name: 'Germany' } })),
          page: Number(params.get('page')),
          pageSize: Number(params.get('pageSize')),
          total: 120,
          totalPages: 3,
        }),
      );
    }),
  );
}

describe('employee list filters (04 sections 8.3 and 8.5)', () => {
  it('changing a filter updates the URL, resets the page to 1 and requests the new query', async () => {
    const requests: URLSearchParams[] = [];
    servesEmployees(requests);
    const user = userEvent.setup();
    renderList('/employees?page=2');
    await screen.findByText('Showing 51 to 100 of 120 employees');

    await user.click(field('Country'));
    await user.click(await screen.findByRole('option', { name: 'India' }));

    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent(/^\/employees\?country=IN$/),
    );
    expect(screen.getByLabelText('location')).toHaveAttribute('data-navigation', 'PUSH');
    await waitFor(() => expect(requests.at(-1)?.get('country')).toBe('IN'));
    expect(requests.at(-1)?.get('page')).toBe('1');

    await user.click(field('Status'));
    await user.click(await screen.findByRole('option', { name: 'Terminated' }));

    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent(
        /^\/employees\?status=terminated&country=IN$/,
      ),
    );
    expect(requests.at(-1)?.get('status')).toBe('terminated');
  });

  it('loading the page from a URL with filters shows those filters selected', async () => {
    const requests: URLSearchParams[] = [];
    servesEmployees(requests);
    renderList(
      '/employees?q=priya&country=IN,US&level=L3&status=all&band=below&salaryUnchangedSince=2025-01-01',
    );

    expect(await findPill('India')).toBeInTheDocument();
    expect(pill('United States')).toBeInTheDocument();
    expect(pill('L3 Senior')).toBeInTheDocument();
    expect(field('Status')).toHaveValue('All');
    expect(field('Pay band')).toHaveValue('Below band');
    expect(screen.getByLabelText('No salary change since')).toHaveValue('2025-01-01');
    expect(screen.getByPlaceholderText('Search name or employee ID')).toHaveValue('priya');
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0]?.get('country')).toBe('IN,US');
    expect(requests[0]?.get('level')).toBe('L3');
    expect(requests[0]?.get('status')).toBe('all');
    expect(requests[0]?.get('band')).toBe('below');
    expect(requests[0]?.get('q')).toBe('priya');
    expect(requests[0]?.get('salaryUnchangedSince')).toBe('2025-01-01');
  });

  it('narrows the job title options to the chosen departments', async () => {
    servesEmployees([]);
    const user = userEvent.setup();
    renderList('/employees?department=2');
    await findPill('Design');

    await user.click(field('Job title'));

    expect(await screen.findByRole('option', { name: 'Product Designer' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Software Engineer' })).not.toBeInTheDocument();
  });

  it('search typing is debounced 300 ms and replaces the history entry', async () => {
    const requests: URLSearchParams[] = [];
    servesEmployees(requests);
    const user = userEvent.setup();
    renderList('/employees');
    await screen.findByText('Showing 1 to 50 of 120 employees');

    await user.type(screen.getByPlaceholderText('Search name or employee ID'), 'pri');

    expect(screen.getByLabelText('location')).toHaveTextContent(/^\/employees$/);
    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent(/^\/employees\?q=pri$/),
    );
    expect(screen.getByLabelText('location')).toHaveAttribute('data-navigation', 'REPLACE');
    await waitFor(() => expect(requests.at(-1)?.get('q')).toBe('pri'));
    expect(requests.map((params) => params.get('q')).filter(Boolean)).toEqual(['pri']);
  });

  it('"Clear filters" removes every filter and the search text', async () => {
    servesEmployees([]);
    const user = userEvent.setup();
    renderList('/employees?q=priya&country=IN&status=all');
    await findPill('India');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() =>
      expect(screen.getByLabelText('location')).toHaveTextContent(/^\/employees$/),
    );
    expect(screen.getByPlaceholderText('Search name or employee ID')).toHaveValue('');
    expect(pill('India')).not.toBeInTheDocument();
  });
});

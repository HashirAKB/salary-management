import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { anEmployeeDetail, anEmployeeListResponse } from '../../../test/fixtures/employees.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const Location = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="location">{pathname + search}</output>;
};

const renderPage = (route = '/employees/new') =>
  render(
    <>
      <AppRoutes />
      <Location />
    </>,
    { route },
  );

const asAdmin = () =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json(aMeResponse('hr_admin'))));

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

const created = () => anEmployeeDetail({ id: 10251, employeeCode: 'E010251' });

/** Answers the POST with 201 and records its body. */
function servesCreate(bodies: unknown[] = []) {
  server.use(
    http.post('/api/employees', async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(created(), {
        status: 201,
        headers: { Location: '/api/employees/10251' },
      });
    }),
    http.get('/api/employees/10251', () => HttpResponse.json(created())),
  );
}

const problem = (status: number, body: Parameters<typeof aProblem>[0]) =>
  HttpResponse.json(aProblem(body), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

type User = ReturnType<typeof userEvent.setup>;

async function choose(user: User, label: string, option: string) {
  await user.click(await screen.findByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function fillForm(user: User, salary = '1980000') {
  await user.type(await screen.findByLabelText('First name'), 'Asha');
  await user.type(screen.getByLabelText('Last name'), 'Rao');
  await choose(user, 'Gender', 'Female');
  await choose(user, 'Country', 'India');
  await choose(user, 'Job title', 'Software Engineer');
  await choose(user, 'Level', 'L3 Senior');
  fireEvent.change(screen.getByLabelText('Hire date'), { target: { value: '2026-01-15' } });
  await user.type(screen.getByLabelText('Starting salary'), salary);
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'Add employee' }));

describe('add employee page (04 section 8.5 S-4)', () => {
  it('shows the band and a "below the band minimum" warning without blocking submit', async () => {
    asAdmin();
    servesBand();
    const bodies: unknown[] = [];
    servesCreate(bodies);
    const user = userEvent.setup();
    renderPage();

    await fillForm(user, '1500000');

    const band = await screen.findByRole('group', { name: 'Pay band' });
    expect(within(band).getByText('INR 16,00,000')).toBeVisible();
    expect(within(band).getByText('INR 20,40,000')).toBeVisible();
    expect(within(band).getByText('INR 25,00,000')).toBeVisible();
    expect(screen.getByText('Compa-ratio 0.74')).toBeVisible();
    expect(screen.getByText('This is below the band minimum.')).toBeVisible();

    await submit(user);
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Nair' })).toBeVisible();
    expect(bodies).toEqual([
      {
        firstName: 'Asha',
        lastName: 'Rao',
        gender: 'female',
        countryCode: 'IN',
        jobTitleId: 1,
        levelCode: 'L3',
        hireDate: '2026-01-15',
        startingSalary: { amountMinor: 150000000, currency: 'INR' },
      },
    ]);
  });

  it('shows no warning inside the band', async () => {
    asAdmin();
    servesBand();
    const user = userEvent.setup();
    renderPage();

    await fillForm(user, '2000000');

    expect(await screen.findByText('Compa-ratio 0.98')).toBeVisible();
    expect(screen.queryByText(/below the band minimum|above the band maximum/)).toBeNull();
  });

  it('checks required fields on the client before sending anything', async () => {
    asAdmin();
    let posted = false;
    server.use(
      http.post('/api/employees', () => {
        posted = true;
        return HttpResponse.json(created(), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Add employee' }));

    expect(await screen.findByLabelText('First name')).toBeInvalid();
    expect(screen.getByLabelText('Starting salary')).toBeInvalid();
    expect(screen.getByLabelText('Hire date')).toBeInvalid();
    expect(posted).toBe(false);
  });

  it('rejects a salary of 0 with a plain message and sends nothing', async () => {
    asAdmin();
    servesBand();
    let posted = false;
    server.use(
      http.post('/api/employees', () => {
        posted = true;
        return HttpResponse.json(created(), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await fillForm(user, '0');

    await submit(user);

    expect(await screen.findByText('Enter an amount greater than zero.')).toBeVisible();
    expect(posted).toBe(false);
  });

  it('maps errors[] from a 400 onto the matching fields', async () => {
    asAdmin();
    servesBand();
    server.use(
      http.post('/api/employees', () =>
        problem(400, {
          status: 400,
          code: 'VALIDATION_FAILED',
          errors: [
            { path: 'lastName', message: 'Last name is not allowed.' },
            { path: 'startingSalary.amountMinor', message: 'Enter a smaller amount.' },
            { path: 'unknownKey', message: 'Something else was wrong.' },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Last name is not allowed.')).toBeVisible();
    expect(screen.getByLabelText('Last name')).toBeInvalid();
    expect(screen.getByText('Enter a smaller amount.')).toBeVisible();
    expect(screen.getByLabelText('Starting salary')).toBeInvalid();
    expect(within(screen.getByRole('alert')).getByText('Something else was wrong.')).toBeVisible();
  });

  it('shows NO_PAY_BAND as a form alert and DATE_IN_FUTURE under the hire date', async () => {
    asAdmin();
    servesBand();
    server.use(
      http.post('/api/employees', () => problem(422, { status: 422, code: 'NO_PAY_BAND' })),
    );
    const user = userEvent.setup();
    renderPage();

    await fillForm(user);
    await submit(user);
    expect(
      await within(await screen.findByRole('alert')).findByText(
        "There's no pay band for this country, job title and level.",
      ),
    ).toBeVisible();

    server.use(
      http.post('/api/employees', () =>
        problem(422, {
          status: 422,
          code: 'DATE_IN_FUTURE',
          detail: 'The hire date can’t be after today.',
        }),
      ),
    );
    await submit(user);
    expect(await screen.findByText('The hire date can’t be after today.')).toBeVisible();
    expect(screen.getByLabelText('Hire date')).toBeInvalid();
  });

  it('shows SALARY_CURRENCY_MISMATCH under the starting salary', async () => {
    asAdmin();
    server.use(
      http.post('/api/employees', () =>
        problem(422, {
          status: 422,
          code: 'SALARY_CURRENCY_MISMATCH',
          detail: 'The salary must be in INR.',
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('The salary must be in INR.')).toBeVisible();
    expect(screen.getByLabelText('Starting salary')).toBeInvalid();
  });

  it('after adding, opens the new employee\'s page with the "Employee E010251 added." toast', async () => {
    asAdmin();
    servesCreate();
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    queryClient.setQueryData(['employees', {}], anEmployeeListResponse());

    await fillForm(user);
    await submit(user);

    expect(await screen.findByText('Employee E010251 added.')).toBeVisible();
    expect(screen.getByLabelText('location')).toHaveTextContent('/employees/10251');
    expect(queryClient.getQueryState(['employees', {}])?.isInvalidated).toBe(true);
  });

  it('Cancel returns to the list with its URL filters', async () => {
    asAdmin();
    server.use(http.get('/api/employees', () => HttpResponse.json(anEmployeeListResponse())));
    const user = userEvent.setup();
    renderPage('/employees?country=IN');

    await user.click(await screen.findByRole('link', { name: 'Add employee' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Employees' })).toBeVisible();
    expect(screen.getByLabelText('location')).toHaveTextContent('/employees?country=IN');
  });
});

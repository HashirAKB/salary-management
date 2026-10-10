import type { Role } from '@acme/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const problemJson = (body: object, status: number, headers: Record<string, string> = {}) =>
  HttpResponse.json(body, {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  });

async function logIn(email = 'hr.admin@acme.test', password = 'demo-password-1') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginPage (S-1)', () => {
  it('shows "Email or password is incorrect." on a 401', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        problemJson(
          aProblem({
            status: 401,
            code: 'INVALID_CREDENTIALS',
            detail: 'Email or password is incorrect.',
          }),
          401,
        ),
      ),
    );
    render(<AppRoutes />, { route: '/login' });

    await logIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('shows the wait in seconds on a 429', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        problemJson(aProblem({ status: 429, code: 'RATE_LIMITED' }), 429, { 'retry-after': '42' }),
      ),
    );
    render(<AppRoutes />, { route: '/login' });

    await logIn();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in 42 seconds.',
    );
  });

  it.each<[Role, string]>([
    ['hr_admin', 'Employees'],
    ['hr_viewer', 'Employees'],
    ['finance', 'Insights'],
  ])(
    'sends HR roles to /employees and Finance to /insights after login (%s)',
    async (role, heading) => {
      server.use(
        http.post('/api/auth/login', () => HttpResponse.json(aMeResponse(role))),
        http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))),
      );
      render(<AppRoutes />, { route: '/login' });

      await logIn(`${role}@acme.test`);

      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    },
  );
});

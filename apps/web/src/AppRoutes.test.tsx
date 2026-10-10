import type { Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { aMeResponse } from '../test/fixtures/me.ts';
import { render } from '../test/render.tsx';
import { server } from '../test/server.ts';
import { AppRoutes } from './AppRoutes.tsx';

const loggedInAs = (role: Role) =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))));

describe('app shell and route guards (04 sections 8.1, 8.2)', () => {
  it.each<[Role, string[]]>([
    ['hr_admin', ['Employees', 'Insights', 'Pay equity']],
    ['hr_viewer', ['Employees', 'Insights', 'Pay equity']],
    ['finance', ['Insights', 'Pay equity']],
  ])('shows each role only its nav links (%s)', async (role, links) => {
    loggedInAs(role);
    render(<AppRoutes />, { route: '/insights' });

    const nav = await screen.findByRole('navigation');

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(links);
  });

  it('shows the forbidden page, not a redirect, when Finance opens /employees', async () => {
    loggedInAs('finance');
    render(<AppRoutes />, { route: '/employees' });

    expect(await screen.findByText("You don't have access to this page.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your start page' })).toHaveAttribute(
      'href',
      '/insights',
    );
    expect(screen.queryByRole('heading', { name: 'Employees' })).not.toBeInTheDocument();
  });

  it('shows the not-found page for an unknown path', async () => {
    loggedInAs('hr_viewer');
    render(<AppRoutes />, { route: '/no-such-page' });

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('logs out from the user menu and returns to /login', async () => {
    let loggedOut = false;
    loggedInAs('hr_admin');
    server.use(
      http.post('/api/auth/logout', () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<AppRoutes />, { route: '/employees' });

    await user.click(await screen.findByRole('button', { name: /HR Admin \(demo\)/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Log out' }));

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(loggedOut).toBe(true);
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { aMeResponse } from '../../test/fixtures/me.ts';
import { render } from '../../test/render.tsx';
import { server } from '../../test/server.ts';
import { AppRoutes } from '../AppRoutes.tsx';
import { COLOR_SCHEME_KEY } from '../theme.ts';

describe('Ask about pay nav entry (05 section 5.2 C row 6)', () => {
  it('shows "Ask about pay" only when askEnabled is true', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json(aMeResponse('hr_admin', { askEnabled: true })),
      ),
    );
    const { unmount } = render(<AppRoutes />, { route: '/employees' });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Ask about pay' })).toBeInTheDocument();
    unmount();

    server.use(http.get('/api/auth/me', () => HttpResponse.json(aMeResponse('hr_admin'))));
    render(<AppRoutes />, { route: '/employees' });
    const hidden = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(hidden).getByRole('link', { name: 'Employees' })).toBeInTheDocument();
    expect(within(hidden).queryByRole('link', { name: 'Ask about pay' })).not.toBeInTheDocument();
  });
});

describe('dark mode toggle (06 S3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.use(http.get('/api/auth/me', () => HttpResponse.json(aMeResponse('hr_admin'))));
  });

  it('switches between dark and light mode and persists the choice in localStorage', async () => {
    const user = userEvent.setup();
    render(<AppRoutes />, { route: '/employees' });

    await user.click(await screen.findByRole('button', { name: 'Switch to dark mode' }));

    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
    expect(window.localStorage.getItem(COLOR_SCHEME_KEY)).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));

    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light');
    expect(window.localStorage.getItem(COLOR_SCHEME_KEY)).toBe('light');
  });
});

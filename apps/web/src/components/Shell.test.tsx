import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { aMeResponse } from '../../test/fixtures/me.ts';
import { render } from '../../test/render.tsx';
import { server } from '../../test/server.ts';
import { AppRoutes } from '../AppRoutes.tsx';
import { COLOR_SCHEME_KEY } from '../theme.ts';

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

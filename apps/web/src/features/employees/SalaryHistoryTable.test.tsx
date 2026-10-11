import type { Role } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { anEmployeeDetail } from '../../../test/fixtures/employees.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aThreeRowHistory } from '../../../test/fixtures/salary.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

const loggedInAs = (role: Role) =>
  server.use(http.get('/api/auth/me', () => HttpResponse.json(aMeResponse(role))));

describe('salary history table (04 section 8.5 S-3)', () => {
  it('shows Imported for seeded rows, a level move for a promotion, and n/a in the hire row', async () => {
    loggedInAs('hr_viewer');
    server.use(
      http.get('/api/employees/4217', () => HttpResponse.json(anEmployeeDetail())),
      http.get('/api/employees/4217/salary-changes', () => HttpResponse.json(aThreeRowHistory())),
    );
    render(<AppRoutes />, { route: '/employees/4217' });

    const history = await screen.findByRole('region', { name: 'Salary history' });
    const rows = within(within(history).getByRole('table')).getAllByRole('row');
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Effective date', 'Reason', 'Amount', 'Change', 'Position', 'Recorded by']);

    const cells = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
    expect(cells(rows[1]!)).toEqual([
      '1 Apr 2026',
      'Promotion',
      'INR 19,80,000',
      '+4.2%',
      'L2 Intermediate to L3 Senior',
      'HR Admin (demo)',
    ]);
    expect(cells(rows[2]!)).toEqual([
      '1 Apr 2023',
      'Merit increase',
      'INR 19,00,000',
      '+26.7%',
      'Software Engineer, L2 Intermediate',
      'Imported',
    ]);
    expect(cells(rows[3]!)).toEqual([
      '12 Jul 2021',
      'Hire',
      'INR 15,00,000',
      'n/a',
      'Software Engineer, L2 Intermediate',
      'Imported',
    ]);
  });
});

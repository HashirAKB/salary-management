import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { aHealthResponse } from '../test/fixtures/health.ts';
import { render } from '../test/render.tsx';
import { server } from '../test/server.ts';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the app shell placeholder with the API status through the test wrapper', async () => {
    server.use(http.get('/api/health', () => HttpResponse.json(aHealthResponse())));

    render(<App />);

    expect(screen.getByRole('heading', { name: 'ACME Salary Manager' })).toBeInTheDocument();
    expect(await screen.findByText('API status: ok')).toBeInTheDocument();
  });
});

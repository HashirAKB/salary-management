import type { AskResponse } from '@acme/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aCannotAnswerResponse, anAnswerResponse } from '../../../test/fixtures/ask.ts';
import { aMeResponse } from '../../../test/fixtures/me.ts';
import { aProblem } from '../../../test/fixtures/problem.ts';
import { render } from '../../../test/render.tsx';
import { server } from '../../../test/server.ts';
import { AppRoutes } from '../../AppRoutes.tsx';

function servesAsk(
  askEnabled: boolean,
  reply: () => Response = () => HttpResponse.json(anAnswerResponse()),
  requests: unknown[] = [],
) {
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json(aMeResponse('hr_admin', { askEnabled }))),
    http.post('/api/ask', async ({ request }) => {
      requests.push(await request.json());
      return reply();
    }),
  );
}

const problem = (
  status: number,
  code: 'ASK_LIMIT_REACHED' | 'ASK_UPSTREAM_FAILED',
  detail: string,
) => aProblem({ status, code, detail });

async function ask(question: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByRole('textbox', { name: 'Your question' }), question);
  await user.click(screen.getByRole('button', { name: 'Ask' }));
  return user;
}

afterEach(() => vi.useRealTimers());

describe('ask page (04 section 8.5, S-10)', () => {
  it('shows the answer, the "How I read your question" list and the FX note', async () => {
    const requests: unknown[] = [];
    servesAsk(true, undefined, requests);
    render(<AppRoutes />, { route: '/ask' });

    await ask('What is the median salary for senior software engineers in India?');

    expect(
      await screen.findByText(/^Median salary for L3 Senior Software Engineer in India/),
    ).toBeInTheDocument();
    expect(requests).toEqual([
      { question: 'What is the median salary for senior software engineers in India?' },
    ]);
    const how = screen.getByRole('list', { name: 'How I read your question' });
    expect(within(how).getByText('Metric')).toBeInTheDocument();
    expect(within(how).getByText('Median salary')).toBeInTheDocument();
    expect(within(how).getByText('L3 Senior')).toBeInTheDocument();
    expect(screen.getByText('FX as of 30 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('3 of 30 questions used today.')).toBeInTheDocument();
  });

  it('the cannot-answer suggestion fills the question box when clicked', async () => {
    servesAsk(true, () => HttpResponse.json(aCannotAnswerResponse() satisfies AskResponse));
    render(<AppRoutes />, { route: '/ask' });

    const user = await ask('How much does Priya earn?');

    expect(await screen.findByText(/not individual people/)).toBeInTheDocument();
    expect(screen.getByText('How does total payroll split by country?')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'What is the average salary for Software Engineers?' }),
    );
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue(
      'What is the average salary for Software Engineers?',
    );
  });

  it('a 429 shows the reset time; a 503 upstream failure shows "Try again"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
    servesAsk(true, () =>
      HttpResponse.json(
        problem(429, 'ASK_LIMIT_REACHED', "You've used your 30 questions for today."),
        { status: 429, headers: { 'Retry-After': String(14 * 3600) } },
      ),
    );
    render(<AppRoutes />, { route: '/ask' });

    await ask('How many people work here?');

    expect(await screen.findByText("You've used your 30 questions for today.")).toBeInTheDocument();
    expect(screen.getByText('Resets at 00:00 your time')).toBeInTheDocument();

    servesAsk(true, () =>
      HttpResponse.json(
        problem(
          503,
          'ASK_UPSTREAM_FAILED',
          "Couldn't read that question right now. Try again, or rephrase it.",
        ),
        { status: 503 },
      ),
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByText(/Couldn't read that question right now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('a direct visit with askEnabled false shows the not-set-up message', async () => {
    servesAsk(false);
    render(<AppRoutes />, { route: '/ask' });

    expect(
      await screen.findByText(
        "Ask about pay isn't set up on this server. Everything else works without it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Your question' })).not.toBeInTheDocument();
  });
});

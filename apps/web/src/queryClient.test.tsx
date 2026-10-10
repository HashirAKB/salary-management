import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { aProblem } from '../test/fixtures/problem.ts';
import { ApiError } from './api/client.ts';
import { createQueryClient } from './queryClient.ts';

describe('createQueryClient (04 section 8.3)', () => {
  it('never retries a query that failed with an ApiError', async () => {
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    let calls = 0;

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['me'],
          queryFn: () => {
            calls += 1;
            throw new ApiError(aProblem({ status: 401, code: 'UNAUTHENTICATED' }));
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(1);
  });
});

import { QueryClient } from '@tanstack/react-query';
import { ApiError, ServerWakingError } from './api/client.ts';

/**
 * The app's query client (04 section 8.3). A problem response is an answer, not a glitch, so it
 * is never retried, and the waking logic owns transport retries (D-045); a 401 from `me` then redirects to login at once (04 section 8.2).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failures, error) =>
          !(error instanceof ApiError || error instanceof ServerWakingError) && failures < 3,
      },
    },
  });
}

import { insightsSummaryResponseSchema, payDistributionResponseSchema } from '@acme/shared';
import type { PayDistributionQuery } from '@acme/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client.ts';
import { serializeInsightsQuery } from './useInsightsFilters.ts';

// Query keys of 04 section 8.3.
export const useSummary = () =>
  useQuery({
    queryKey: ['insights', 'summary'],
    queryFn: () => apiFetch('/api/insights/summary', { schema: insightsSummaryResponseSchema }),
    staleTime: 30_000,
  });

export const useDistribution = (query: PayDistributionQuery) =>
  useQuery({
    queryKey: ['insights', 'distribution', query],
    queryFn: () =>
      apiFetch(
        `/api/insights/pay-distribution?${serializeInsightsQuery(query, { forUrl: false })}`,
        { schema: payDistributionResponseSchema },
      ),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

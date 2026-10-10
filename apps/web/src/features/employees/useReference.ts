import { referenceResponseSchema } from '@acme/shared';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client.ts';

/** R1 reference data (04 section 5.3); it only changes with a release, so it is fetched once. */
export const useReference = () =>
  useQuery({
    queryKey: ['reference'],
    queryFn: () => apiFetch('/api/reference', { schema: referenceResponseSchema }),
    staleTime: Infinity,
  });

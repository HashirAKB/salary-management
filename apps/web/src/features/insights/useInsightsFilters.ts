import { payDistributionQuerySchema, type PayDistributionQuery } from '@acme/shared';
import { useNavigate, useSearchParams } from 'react-router';

type FilterChange = Partial<PayDistributionQuery>;

const LIST_KEYS = ['country', 'department', 'jobTitle', 'level', 'gender'] as const;
const DEFAULT_GROUP = 'country';
const shape: Record<string, { safeParse(value: unknown): { success: boolean } }> =
  payDistributionQuerySchema.shape;

const join = (values: string[]) => values.map(encodeURIComponent).join(',');

/** The query string for the API and the URL; `groupBy` is left out of the URL when default. */
export function serializeInsightsQuery(
  query: PayDistributionQuery,
  { forUrl }: { forUrl: boolean },
): string {
  const parts: string[] = [];
  if (!forUrl || query.groupBy !== DEFAULT_GROUP) parts.push(`groupBy=${query.groupBy}`);
  for (const key of LIST_KEYS) {
    const values = query[key];
    if (values !== undefined && values.length > 0) parts.push(`${key}=${join(values)}`);
  }
  return parts.join('&');
}

/** Distribution state kept in the URL (04 section 8.3); anything unrecognised is ignored. */
export function useInsightsFilters(): {
  query: PayDistributionQuery;
  setFilters: (change: FilterChange) => void;
} {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const valid: Record<string, string> = {};
  for (const [key, value] of params) {
    if (shape[key]?.safeParse(value).success) valid[key] = value;
  }
  const query = payDistributionQuerySchema.parse(valid);
  return {
    query,
    setFilters: (change) => {
      const search = serializeInsightsQuery({ ...query, ...change }, { forUrl: true });
      void navigate({ search: search ? `?${search}` : '' });
    },
  };
}

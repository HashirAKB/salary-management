import { payEquityQuerySchema, type PayEquityQuery } from '@acme/shared';
import { useNavigate, useSearchParams } from 'react-router';

const shape: Record<string, { safeParse(value: unknown): { success: boolean } }> =
  payEquityQuerySchema.shape;

const join = (values: string[]) => values.map(encodeURIComponent).join(',');

/** The query string for the API (every key) or the URL (defaults left out). */
export function serializePayEquityQuery(
  query: PayEquityQuery,
  { forUrl }: { forUrl: boolean },
): string {
  const parts: string[] = [];
  if (query.country?.length) parts.push(`country=${join(query.country)}`);
  if (query.department?.length) parts.push(`department=${join(query.department)}`);
  if (!forUrl || query.flaggedOnly) parts.push(`flaggedOnly=${query.flaggedOnly}`);
  if (!forUrl || query.includeNotComparable)
    parts.push(`includeNotComparable=${query.includeNotComparable}`);
  return parts.join('&');
}

/** Pay equity filters kept in the URL (04 section 8.3); anything unrecognised is ignored. */
export function usePayEquityFilters(): {
  query: PayEquityQuery;
  setFilters: (change: Partial<PayEquityQuery>) => void;
} {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const valid: Record<string, string> = {};
  for (const [key, value] of params) {
    if (shape[key]?.safeParse(value).success) valid[key] = value;
  }
  const query = payEquityQuerySchema.parse(valid);
  return {
    query,
    setFilters: (change) => {
      const search = serializePayEquityQuery({ ...query, ...change }, { forUrl: true });
      void navigate({ search: search ? `?${search}` : '' });
    },
  };
}

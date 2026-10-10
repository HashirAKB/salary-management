import {
  employeeListQuerySchema,
  serializeEmployeeListQuery,
  type EmployeeListQuery,
  type ReferenceResponse,
} from '@acme/shared';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useReference } from './useReference.ts';

type FilterChange = Partial<Omit<EmployeeListQuery, 'page'>>;

const LIST_KEYS = ['country', 'department', 'jobTitle', 'level', 'gender'] as const;
const shape: Record<string, { safeParse(value: unknown): { success: boolean } }> =
  employeeListQuerySchema.shape;

const knownValues = (
  reference: ReferenceResponse,
): Record<(typeof LIST_KEYS)[number], string[]> => ({
  country: reference.countries.map((c) => c.code),
  department: reference.departments.map((d) => String(d.id)),
  jobTitle: reference.jobTitles.map((t) => String(t.id)),
  level: reference.levels.map((l) => l.code),
  gender: reference.genders.map((g) => g.code),
});

/**
 * The query a URL stands for. Anything the schema or the reference data doesn't recognise is
 * left out and reported in `dropped` (04 section 8.3).
 */
function parseUrl(
  params: URLSearchParams,
  reference: ReferenceResponse | undefined,
): { query: EmployeeListQuery; dropped: boolean } {
  let dropped = false;
  const valid: Record<string, string> = {};
  for (const [key, value] of params) {
    if (shape[key]?.safeParse(value).success) valid[key] = value;
    else dropped = true;
  }
  const query = employeeListQuerySchema.parse(valid);
  if (reference) {
    const known = knownValues(reference);
    for (const key of LIST_KEYS) {
      const values = query[key];
      const kept = values?.filter((value) => known[key].includes(value));
      if (kept && kept.length !== values?.length) {
        dropped = true;
        query[key] = kept;
      }
    }
  }
  return { query, dropped };
}

/** List state kept in the URL (04 section 8.3); defaults are left out of it. */
export function useEmployeeFilters(): {
  query: EmployeeListQuery;
  page: number;
  pageSize: number;
  /** False until the reference data that list values are checked against has loaded. */
  ready: boolean;
  /** True once a URL value was dropped; the page shows the notice. */
  droppedValues: boolean;
  dismissDropped: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: EmployeeListQuery['pageSize']) => void;
  /** Changes filters or sort and goes back to page 1; `replace` skips a history entry. */
  setFilters: (change: FilterChange, options?: { replace?: boolean }) => void;
  clearFilters: () => void;
} {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = useReference();
  const ready = !reference.isPending;
  const { query, dropped } = parseUrl(params, reference.data);
  const [droppedValues, setDroppedValues] = useState(false);

  const go = (next: EmployeeListQuery, replace = false) => {
    const search = serializeEmployeeListQuery(next);
    void navigate({ search: search ? `?${search}` : '' }, { replace });
  };

  // Rewrite the URL without the dropped values; the notice outlives the rewrite.
  useEffect(() => {
    if (dropped && ready) {
      setDroppedValues(true);
      const search = serializeEmployeeListQuery(query);
      void navigate({ search: search ? `?${search}` : '' }, { replace: true });
    }
  }, [dropped, ready, query, navigate]);

  return {
    query,
    page: query.page,
    pageSize: query.pageSize,
    ready,
    droppedValues,
    dismissDropped: () => setDroppedValues(false),
    setPage: (page) => go({ ...query, page }),
    // A new page size starts again from page 1.
    setPageSize: (pageSize) => go({ ...query, page: 1, pageSize }),
    setFilters: (change, { replace } = {}) => go({ ...query, ...change, page: 1 }, replace),
    clearFilters: () => go({ ...employeeListQuerySchema.parse({}), pageSize: query.pageSize }),
  };
}

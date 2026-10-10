import {
  employeeListQuerySchema,
  serializeEmployeeListQuery,
  type EmployeeListQuery,
} from '@acme/shared';
import { useNavigate, useSearchParams } from 'react-router';

type FilterChange = Partial<Omit<EmployeeListQuery, 'page'>>;

/** List state kept in the URL (04 section 8.3); defaults are left out of it. */
export function useEmployeeFilters(): {
  query: EmployeeListQuery;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: EmployeeListQuery['pageSize']) => void;
  /** Changes filters or sort and goes back to page 1; `replace` skips a history entry. */
  setFilters: (change: FilterChange, options?: { replace?: boolean }) => void;
  clearFilters: () => void;
} {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const parsed = employeeListQuerySchema.safeParse(Object.fromEntries(params));
  const query = parsed.success ? parsed.data : employeeListQuerySchema.parse({});

  const go = (next: EmployeeListQuery, replace = false) => {
    const search = serializeEmployeeListQuery(next);
    void navigate({ search: search ? `?${search}` : '' }, { replace });
  };

  return {
    query,
    page: query.page,
    pageSize: query.pageSize,
    setPage: (page) => go({ ...query, page }),
    // A new page size starts again from page 1.
    setPageSize: (pageSize) => go({ ...query, page: 1, pageSize }),
    setFilters: (change, { replace } = {}) => go({ ...query, ...change, page: 1 }, replace),
    clearFilters: () => go({ ...employeeListQuerySchema.parse({}), pageSize: query.pageSize }),
  };
}

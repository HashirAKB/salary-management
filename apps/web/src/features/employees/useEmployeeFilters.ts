import { useSearchParams } from 'react-router';

const DEFAULT_PAGE_SIZE = 50;

/** List state kept in the URL (04 section 8.3); defaults are left out of it. */
export function useEmployeeFilters(): {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
} {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? DEFAULT_PAGE_SIZE);

  const update = (next: { page: number; pageSize: number }) => {
    const search = new URLSearchParams();
    if (next.page !== 1) search.set('page', String(next.page));
    if (next.pageSize !== DEFAULT_PAGE_SIZE) search.set('pageSize', String(next.pageSize));
    setParams(search);
  };

  return {
    page,
    pageSize,
    setPage: (nextPage) => update({ page: nextPage, pageSize }),
    // A new page size starts again from page 1.
    setPageSize: (nextSize) => update({ page: 1, pageSize: nextSize }),
  };
}

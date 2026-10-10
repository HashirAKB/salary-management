/** List state kept in the URL (04 section 8.3); defaults are left out of it. */
export function useEmployeeFilters(): {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
} {
  throw new Error('not implemented');
}

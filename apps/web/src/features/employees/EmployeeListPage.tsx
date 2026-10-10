import type { EmployeeListItem } from '@acme/shared';
import { employeeListResponseSchema, serializeEmployeeListQuery } from '@acme/shared';
import {
  Alert,
  Badge,
  Button,
  Group,
  Pagination,
  Progress,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { apiFetch } from '../../api/client.ts';
import { FxAsOf } from '../../components/FxAsOf.tsx';
import { Money } from '../../components/Money.tsx';
import { useViewer } from '../../components/Shell.tsx';
import { formatCompaRatio, formatDate } from '../../format.ts';
import { EmployeeFilterBar } from './EmployeeFilterBar.tsx';
import { useEmployeeFilters } from './useEmployeeFilters.ts';

const BAND_LABELS = { below: 'Below', inside: 'Inside', above: 'Above' } as const;
const BAND_COLORS = { below: 'orange', inside: 'green', above: 'blue' } as const;
const COLUMNS = [
  'Employee ID',
  'Name',
  'Country',
  'Job title',
  'Level',
  'Salary',
  'Band',
  'Hire date',
];
const SORTABLE = { Name: 'name', Salary: 'salaryUsd', 'Hire date': 'hireDate' } as const;
const SKELETON_ROWS = 10;
const PAGE_SIZES = ['25', '50', '100'];
const count = new Intl.NumberFormat('en-US');

function EmployeeRow({ employee }: { employee: EmployeeListItem }): ReactElement {
  return (
    <Table.Tr>
      <Table.Td>{employee.employeeCode}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <span>{`${employee.firstName} ${employee.lastName}`}</span>
          {employee.status === 'terminated' && (
            <Badge color="gray" variant="light">
              Terminated
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>{employee.country.name}</Table.Td>
      <Table.Td>{employee.jobTitle.name}</Table.Td>
      <Table.Td>{`${employee.level.code} ${employee.level.name}`}</Table.Td>
      <Table.Td>
        <Money value={employee.salary} display="block" />
        <Money value={employee.salaryUsd} display="block" size="xs" c="dimmed" />
      </Table.Td>
      <Table.Td>
        <Tooltip label={`Compa-ratio ${formatCompaRatio(employee.compaRatio)}`}>
          <Badge color={BAND_COLORS[employee.bandPosition]} variant="light">
            {BAND_LABELS[employee.bandPosition]}
          </Badge>
        </Tooltip>
      </Table.Td>
      <Table.Td>{formatDate(employee.hireDate)}</Table.Td>
    </Table.Tr>
  );
}

/** S-2 Employees list (04 section 8.5). */
export function EmployeeListPage(): ReactElement {
  const filters = useEmployeeFilters();
  const { query, page, pageSize, setPage, setPageSize, setFilters, clearFilters } = filters;
  const sort = query.sort ?? 'name';
  const order = query.order ?? 'asc';
  const sortBy = (column: (typeof SORTABLE)[keyof typeof SORTABLE]) =>
    setFilters(
      column === sort
        ? { order: order === 'asc' ? 'desc' : undefined }
        : { sort: column === 'name' ? undefined : column, order: undefined },
    );
  const filtered =
    query.status !== 'active' ||
    [query.q, query.band, query.salaryUnchangedSince].some(Boolean) ||
    [query.country, query.department, query.jobTitle, query.level, query.gender].some(
      (values) => values && values.length > 0,
    );
  // page and pageSize are always sent; the serializer leaves out every default.
  const filterQuery = serializeEmployeeListQuery({ ...query, page: 1, pageSize: 50 });
  const employees = useQuery({
    queryKey: ['employees', query],
    queryFn: () =>
      apiFetch(
        `/api/employees?page=${page}&pageSize=${pageSize}${filterQuery && `&${filterQuery}`}`,
        { schema: employeeListResponseSchema },
      ),
    enabled: filters.ready,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const data = employees.data;
  const loadingNext = employees.isPlaceholderData;
  const empty = data?.total === 0;
  const pastTheEnd =
    data !== undefined && data.total > 0 && data.items.length === 0 && data.page > data.totalPages;
  const showTable = !empty && (data !== undefined || !employees.isError);
  const canAdd = useViewer().permissions.includes('employee.write');
  const addButton = (
    <Button component={Link} to="/employees/new">
      Add employee
    </Button>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={1}>Employees</Title>
        {canAdd && !empty && addButton}
      </Group>
      {filters.droppedValues && (
        <Alert color="yellow" withCloseButton onClose={filters.dismissDropped}>
          Some filters in this link weren't recognised and were removed.
        </Alert>
      )}
      <EmployeeFilterBar filters={filters} />
      {employees.isError && (
        <Alert color="red">
          <Group justify="space-between">
            <Text>{employees.error.message}</Text>
            <Button variant="light" onClick={() => void employees.refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      )}
      {empty && filtered && (
        <Stack align="flex-start">
          <Text>No employees match these filters.</Text>
          <Button variant="light" onClick={clearFilters}>
            Clear filters
          </Button>
        </Stack>
      )}
      {empty && !filtered && (
        <Stack align="flex-start">
          <Text>No employees yet.</Text>
          {canAdd && addButton}
        </Stack>
      )}
      {data && !pastTheEnd && (
        <Text>
          {`Showing ${count.format((data.page - 1) * data.pageSize + 1)} to ${count.format(
            Math.min(data.page * data.pageSize, data.total),
          )} of ${count.format(data.total)} employees`}
        </Text>
      )}
      {data && pastTheEnd && (
        <Alert color="yellow">
          <Group justify="space-between">
            <Text>This page is past the end of the results.</Text>
            <Button variant="light" onClick={() => setPage(data.totalPages)}>
              Go to last page
            </Button>
          </Group>
        </Alert>
      )}
      {loadingNext && <Progress value={100} animated size={3} aria-label="Loading page" />}
      {showTable && (
        <Table
          striped
          data-fetching={loadingNext || undefined}
          style={loadingNext ? { opacity: 0.5 } : undefined}
        >
          <Table.Thead>
            <Table.Tr>
              {COLUMNS.map((column) => {
                const key = SORTABLE[column as keyof typeof SORTABLE] as string | undefined;
                if (!key) return <Table.Th key={column}>{column}</Table.Th>;
                const active = key === sort;
                return (
                  <Table.Th
                    key={column}
                    aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <UnstyledButton
                      fw="inherit"
                      onClick={() => sortBy(key as (typeof SORTABLE)[keyof typeof SORTABLE])}
                    >
                      {column}
                      {active && <span aria-hidden>{order === 'asc' ? ' ▲' : ' ▼'}</span>}
                    </UnstyledButton>
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data
              ? data.items.map((employee) => <EmployeeRow key={employee.id} employee={employee} />)
              : Array.from({ length: SKELETON_ROWS }, (_, row) => (
                  <Table.Tr key={row}>
                    {COLUMNS.map((column) => (
                      <Table.Td key={column}>
                        <Skeleton height={16} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
          </Table.Tbody>
        </Table>
      )}
      {data && !empty && (
        <Group justify="space-between">
          <Pagination value={data.page} total={data.totalPages} onChange={setPage} />
          <Select
            aria-label="Page size"
            w={90}
            allowDeselect={false}
            data={PAGE_SIZES}
            value={String(pageSize)}
            onChange={(value) => value && setPageSize(Number(value) as 25 | 50 | 100)}
          />
          <FxAsOf date={data.fxAsOf} />
        </Group>
      )}
    </Stack>
  );
}

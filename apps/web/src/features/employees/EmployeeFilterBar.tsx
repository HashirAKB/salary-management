import type { EmployeeListQuery } from '@acme/shared';
import { Button, Group, MultiSelect, Select, TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { useEmployeeFilters } from './useEmployeeFilters.ts';
import { useReference } from './useReference.ts';

const SEARCH_DEBOUNCE_MS = 300;
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'all', label: 'All' },
];
const BAND_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'below', label: 'Below band' },
  { value: 'above', label: 'Above band' },
  { value: 'outside', label: 'Outside band' },
  { value: 'inside', label: 'Inside band' },
];

type ListKey = 'country' | 'department' | 'jobTitle' | 'level' | 'gender';

/** Filter bar of S-2 (04 section 8.5); every change goes through `setFilters`. */
export function EmployeeFilterBar({
  filters,
}: {
  filters: ReturnType<typeof useEmployeeFilters>;
}): ReactElement {
  const { query, setFilters, clearFilters } = filters;
  const reference = useReference().data;

  const [search, setSearch] = useState(query.q ?? '');
  // The last q this bar put in the URL; a different q in the URL came from outside (back, clear).
  const sentQ = useRef(query.q);
  useEffect(() => {
    if (query.q !== sentQ.current) {
      sentQ.current = query.q;
      setSearch(query.q ?? '');
    }
  }, [query.q]);
  const sendSearch = useDebouncedCallback((value: string) => {
    const q = value.trim() || undefined;
    sentQ.current = q;
    setFilters({ q }, { replace: true });
  }, SEARCH_DEBOUNCE_MS);

  const departmentIds = (query.department ?? []).map(Number);
  const titles = (reference?.jobTitles ?? []).filter(
    (title) => departmentIds.length === 0 || departmentIds.includes(title.departmentId),
  );
  const options: Record<ListKey, { value: string; label: string }[]> = {
    country: (reference?.countries ?? []).map((c) => ({ value: c.code, label: c.name })),
    department: (reference?.departments ?? []).map((d) => ({
      value: String(d.id),
      label: d.name,
    })),
    jobTitle: titles.map((t) => ({ value: String(t.id), label: t.name })),
    level: (reference?.levels ?? []).map((l) => ({ value: l.code, label: `${l.code} ${l.name}` })),
    gender: (reference?.genders ?? []).map((g) => ({ value: g.code, label: g.name })),
  };

  const multi = (key: ListKey, label: string) => (
    <MultiSelect
      key={key}
      label={label}
      data={options[key]}
      value={query[key] ?? []}
      onChange={(values) => setFilters({ [key]: values.length > 0 ? values : undefined })}
      clearable
    />
  );

  return (
    <Group align="flex-end" gap="sm">
      <TextInput
        label="Search"
        placeholder="Search name or employee ID"
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
          sendSearch(event.currentTarget.value);
        }}
      />
      {multi('country', 'Country')}
      {multi('department', 'Department')}
      {multi('jobTitle', 'Job title')}
      {multi('level', 'Level')}
      {multi('gender', 'Gender')}
      <Select
        label="Status"
        allowDeselect={false}
        data={STATUS_OPTIONS}
        value={query.status}
        onChange={(value) => value && setFilters({ status: value as EmployeeListQuery['status'] })}
      />
      <Select
        label="Pay band"
        allowDeselect={false}
        data={BAND_OPTIONS}
        value={query.band ?? 'any'}
        onChange={(value) =>
          setFilters({ band: value === 'any' ? undefined : (value as EmployeeListQuery['band']) })
        }
      />
      <TextInput
        type="date"
        label="No salary change since"
        value={query.salaryUnchangedSince ?? ''}
        onChange={(event) =>
          setFilters({ salaryUnchangedSince: event.currentTarget.value || undefined })
        }
      />
      <Button
        variant="subtle"
        onClick={() => {
          sendSearch.cancel();
          clearFilters();
        }}
      >
        Clear filters
      </Button>
    </Group>
  );
}

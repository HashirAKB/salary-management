import { payEquityResponseSchema, type PayEquityQuery, type PayEquityResponse } from '@acme/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  MultiSelect,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { apiFetch } from '../../api/client.ts';
import { FxAsOf } from '../../components/FxAsOf.tsx';
import { Money } from '../../components/Money.tsx';
import { formatGapPct } from '../../format.ts';
import { useReference } from '../employees/useReference.ts';
import { serializePayEquityQuery, usePayEquityFilters } from './usePayEquityFilters.ts';

const TOO_FEW = 'Too few to compare';
const COLUMNS = [
  'Country',
  'Job title',
  'Level',
  'Women',
  'Men',
  'Mean (women)',
  'Mean (men)',
  'Gap',
  'Status',
];
const NUMBER_COLUMNS = 5; // Women, Men, Mean (women), Mean (men), Gap

const usePayEquity = (query: PayEquityQuery) =>
  useQuery({
    queryKey: ['insights', 'pay-equity', query],
    queryFn: () =>
      apiFetch(`/api/insights/pay-equity?${serializePayEquityQuery(query, { forUrl: false })}`, {
        schema: payEquityResponseSchema,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

function GapCard({ label, value }: { label: string; value: number | null }): ReactElement {
  return (
    <Card withBorder>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {formatGapPct(value)}
      </Text>
    </Card>
  );
}

function CohortRow({ cohort }: { cohort: PayEquityResponse['cohorts'][number] }): ReactElement {
  return (
    <Table.Tr>
      <Table.Td>{cohort.country.name}</Table.Td>
      <Table.Td>{cohort.jobTitle.name}</Table.Td>
      <Table.Td>{`${cohort.level.code} ${cohort.level.name}`}</Table.Td>
      {cohort.comparable && cohort.meanWomen && cohort.meanMen ? (
        <>
          <Table.Td>{cohort.women}</Table.Td>
          <Table.Td>{cohort.men}</Table.Td>
          <Table.Td>
            <Money value={cohort.meanWomen} />
          </Table.Td>
          <Table.Td>
            <Money value={cohort.meanMen} />
          </Table.Td>
          <Table.Td>{formatGapPct(cohort.gapPct)}</Table.Td>
        </>
      ) : (
        <Table.Td colSpan={NUMBER_COLUMNS}>{TOO_FEW}</Table.Td>
      )}
      <Table.Td>
        {cohort.flagged && (
          <Badge color="orange" variant="light" leftSection={<span aria-hidden>⚠</span>}>
            Review
          </Badge>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

/** S-9 Pay equity (04 section 8.5). */
export function PayEquityPage(): ReactElement {
  const { query, setFilters } = usePayEquityFilters();
  const reference = useReference().data;
  const equity = usePayEquity(query);
  const data = equity.data;
  return (
    <Stack>
      <Title order={1}>Pay equity</Title>
      <Group align="flex-end" gap="sm">
        <MultiSelect
          label="Country"
          data={(reference?.countries ?? []).map((c) => ({ value: c.code, label: c.name }))}
          value={query.country ?? []}
          onChange={(values) => setFilters({ country: values.length > 0 ? values : undefined })}
          clearable
        />
        <MultiSelect
          label="Department"
          data={(reference?.departments ?? []).map((d) => ({
            value: String(d.id),
            label: d.name,
          }))}
          value={query.department ?? []}
          onChange={(values) => setFilters({ department: values.length > 0 ? values : undefined })}
          clearable
        />
        <Checkbox
          label="Flagged only"
          checked={query.flaggedOnly}
          onChange={(event) => setFilters({ flaggedOnly: event.currentTarget.checked })}
        />
        <Checkbox
          label="Show cohorts too small to compare"
          checked={query.includeNotComparable}
          onChange={(event) => setFilters({ includeNotComparable: event.currentTarget.checked })}
        />
      </Group>
      {equity.isError && (
        <Alert color="red">
          <Group justify="space-between">
            <Text>{equity.error.message}</Text>
            <Button variant="light" onClick={() => void equity.refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      )}
      {!data && !equity.isError && <Skeleton height={160} />}
      {data && (
        <>
          <Group grow align="stretch">
            <GapCard label="Mean gap (unadjusted)" value={data.org.meanGapPct} />
            <GapCard label="Median gap (unadjusted)" value={data.org.medianGapPct} />
          </Group>
          <Text size="sm" c="dimmed">
            Compares all women with all men, across different roles and levels. Use the cohort table
            for like-for-like comparisons.
          </Text>
          <Text>
            {`${data.cohortCounts.comparable} of ${data.cohortCounts.withEmployees} cohorts can be compared; ${data.cohortCounts.flagged} are flagged.`}
          </Text>
          {data.cohorts.length === 0 ? (
            <Text>No cohorts match these filters.</Text>
          ) : (
            <Table aria-label="Pay equity cohorts" striped>
              <Table.Thead>
                <Table.Tr>
                  {COLUMNS.map((column) => (
                    <Table.Th key={column}>{column}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.cohorts.map((cohort) => (
                  <CohortRow
                    key={`${cohort.country.code}-${cohort.jobTitle.id}-${cohort.level.code}`}
                    cohort={cohort}
                  />
                ))}
              </Table.Tbody>
            </Table>
          )}
          <Text size="xs" c="dimmed">
            Flagged at a gap of 5% or more, the EU Pay Transparency Directive's joint pay assessment
            trigger. Cohorts need at least 5 women and 5 men. A flag is a signal to review, not a
            legal finding.
          </Text>
          <FxAsOf date={data.fxAsOf} />
        </>
      )}
    </Stack>
  );
}

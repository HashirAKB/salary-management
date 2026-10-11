import { sharePct } from '@acme/shared';
import type {
  InsightsSummaryResponse,
  Money as MoneyValue,
  PayDistributionResponse,
} from '@acme/shared';
import { BarChart } from '@mantine/charts';
import {
  Alert,
  Button,
  Card,
  Group,
  MultiSelect,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router';
import { FxAsOf } from '../../components/FxAsOf.tsx';
import { Money } from '../../components/Money.tsx';
import { useViewer } from '../../components/Shell.tsx';
import { formatDate, formatMoney, formatSharePct } from '../../format.ts';
import { useReference } from '../employees/useReference.ts';
import { useDistribution, useSummary } from './api.ts';
import { useInsightsFilters } from './useInsightsFilters.ts';

const HIDDEN = 'Hidden to protect small groups';
const count = new Intl.NumberFormat('en-US');
const GROUP_BY = [
  { value: 'country', label: 'Country' },
  { value: 'department', label: 'Department' },
  { value: 'jobTitle', label: 'Job title' },
  { value: 'level', label: 'Level' },
  { value: 'gender', label: 'Gender' },
];
const STATS = ['min', 'p25', 'median', 'p75', 'max', 'average'] as const;
const STAT_LABELS = ['Min', 'P25', 'Median', 'P75', 'Max', 'Average'];

const usdTick = (minor: number) => formatMoney({ amountMinor: minor, currency: 'USD' });

function SectionError({ message, retry }: { message: string; retry: () => void }): ReactElement {
  return (
    <Alert color="red">
      <Group justify="space-between">
        <Text>{message}</Text>
        <Button variant="light" onClick={retry}>
          Retry
        </Button>
      </Group>
    </Alert>
  );
}

function StatCard({
  label,
  value,
  note,
  to,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  to?: string;
}): ReactElement {
  const body = (
    <>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value}
      </Text>
      {note && (
        <Text size="xs" c="dimmed">
          {note}
        </Text>
      )}
    </>
  );
  return to ? (
    <Card withBorder component={Link} to={to}>
      {body}
    </Card>
  ) : (
    <Card withBorder>{body}</Card>
  );
}

function Cards({
  summary,
  canDrillDown,
}: {
  summary: InsightsSummaryResponse;
  canDrillDown: boolean;
}) {
  const { outsideBand, staleSalaries } = summary;
  return (
    <Group grow align="stretch">
      <StatCard label="Active headcount" value={count.format(summary.headcount)} />
      <StatCard label="Annual payroll (USD)" value={<Money value={summary.payrollUsd} />} />
      <StatCard
        label="Paid outside band"
        value={count.format(outsideBand.total)}
        note={`${count.format(outsideBand.below)} below, ${count.format(outsideBand.above)} above`}
        to={canDrillDown ? '/employees?band=outside' : undefined}
      />
      <StatCard
        label={`No salary change since ${formatDate(staleSalaries.since)}`}
        value={count.format(staleSalaries.count)}
        to={canDrillDown ? `/employees?salaryUnchangedSince=${staleSalaries.since}` : undefined}
      />
    </Group>
  );
}

function PayrollByCountry({ summary }: { summary: InsightsSummaryResponse }): ReactElement {
  const total = summary.payrollUsd.amountMinor;
  const share = (usd: MoneyValue | null) =>
    usd === null ? null : total === 0 ? 0 : sharePct(usd.amountMinor, total);
  const chart = summary.byCountry
    .filter((row) => row.payrollUsd !== null)
    .map((row) => ({ country: row.country.name, payroll: row.payrollUsd?.amountMinor ?? 0 }));
  return (
    <Stack>
      <Title order={2} size="h3">
        Payroll by country
      </Title>
      <Table.ScrollContainer minWidth={600}>
        <Table aria-label="Payroll by country" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Country</Table.Th>
              <Table.Th>Headcount</Table.Th>
              <Table.Th>Payroll local</Table.Th>
              <Table.Th>Payroll USD</Table.Th>
              <Table.Th>Share of payroll</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary.byCountry.map((row) => (
              <Table.Tr key={row.country.code}>
                <Table.Td>{row.country.name}</Table.Td>
                {row.suppressed || row.payrollUsd === null || row.payrollLocal === null ? (
                  <Table.Td colSpan={3}>{HIDDEN}</Table.Td>
                ) : (
                  <>
                    <Table.Td>{count.format(row.headcount ?? 0)}</Table.Td>
                    <Table.Td>
                      <Money value={row.payrollLocal} />
                    </Table.Td>
                    <Table.Td>
                      <Money value={row.payrollUsd} />
                    </Table.Td>
                  </>
                )}
                <Table.Td>{formatSharePct(share(row.payrollUsd))}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {chart.length > 0 && (
        <BarChart
          h={240}
          data={chart}
          dataKey="country"
          series={[{ name: 'payroll', label: 'Payroll USD', color: 'blue.6' }]}
          valueFormatter={usdTick}
          yAxisProps={{ tickFormatter: usdTick, width: 90 }}
        />
      )}
      <FxAsOf date={summary.fxAsOf} />
    </Stack>
  );
}

function DistributionRow({
  group,
}: {
  group: PayDistributionResponse['groups'][number];
}): ReactElement {
  const { usd, local } = group;
  return (
    <Table.Tr>
      <Table.Td>{group.label}</Table.Td>
      {group.suppressed || usd === null ? (
        <Table.Td colSpan={7}>{HIDDEN}</Table.Td>
      ) : (
        <>
          <Table.Td>{count.format(group.headcount ?? 0)}</Table.Td>
          {STATS.map((stat) => (
            <Table.Td key={stat}>
              <Money value={usd[stat]} display="block" />
              {local && <Money value={local[stat]} display="block" size="xs" c="dimmed" />}
            </Table.Td>
          ))}
        </>
      )}
    </Table.Tr>
  );
}

function Distribution(): ReactElement {
  const { query, setFilters } = useInsightsFilters();
  const reference = useReference().data;
  const distribution = useDistribution(query);
  const data = distribution.data;
  const options = {
    country: (reference?.countries ?? []).map((c) => ({ value: c.code, label: c.name })),
    department: (reference?.departments ?? []).map((d) => ({
      value: String(d.id),
      label: d.name,
    })),
    jobTitle: (reference?.jobTitles ?? []).map((t) => ({ value: String(t.id), label: t.name })),
    level: (reference?.levels ?? []).map((l) => ({ value: l.code, label: `${l.code} ${l.name}` })),
  };
  const filter = (key: keyof typeof options, label: string) => (
    <MultiSelect
      label={label}
      data={options[key]}
      value={query[key] ?? []}
      onChange={(values) => setFilters({ [key]: values.length > 0 ? values : undefined })}
      clearable
      style={{ flex: '1 1 10rem', minWidth: 0 }}
    />
  );
  const chart = (data?.groups ?? [])
    .filter((group) => group.usd !== null)
    .map((group) => ({ group: group.label, median: group.usd?.median.amountMinor ?? 0 }));
  return (
    <Stack>
      <Title order={2} size="h3">
        Pay distribution
      </Title>
      <SegmentedControl
        aria-label="Group by"
        maw="100%"
        style={{ overflowX: 'auto' }}
        data={GROUP_BY}
        value={query.groupBy}
        onChange={(value) => setFilters({ groupBy: value as typeof query.groupBy })}
      />
      <Group align="flex-end" gap="sm">
        {filter('country', 'Country')}
        {filter('department', 'Department')}
        {filter('jobTitle', 'Job title')}
        {filter('level', 'Level')}
      </Group>
      {distribution.isError && (
        <SectionError
          message={distribution.error.message}
          retry={() => void distribution.refetch()}
        />
      )}
      {!data && !distribution.isError && <Skeleton height={120} />}
      {data && data.groups.length === 0 && <Text>No active employees match these filters.</Text>}
      {data && data.groups.length > 0 && (
        <>
          <Table.ScrollContainer minWidth={900}>
            <Table aria-label="Pay distribution" striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Group</Table.Th>
                  <Table.Th>Headcount</Table.Th>
                  {STAT_LABELS.map((label) => (
                    <Table.Th key={label}>{label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.groups.map((group) => (
                  <DistributionRow key={group.key} group={group} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {chart.length > 0 && (
            <BarChart
              h={240}
              data={chart}
              dataKey="group"
              series={[{ name: 'median', label: 'Median USD', color: 'teal.6' }]}
              valueFormatter={usdTick}
              yAxisProps={{ tickFormatter: usdTick, width: 90 }}
            />
          )}
          <FxAsOf date={data.fxAsOf} />
        </>
      )}
    </Stack>
  );
}

/** S-8 Insights (04 section 8.5). */
export function InsightsPage(): ReactElement {
  const canDrillDown = useViewer().permissions.includes('employee.read');
  const summary = useSummary();
  return (
    <Stack gap="xl">
      <Title order={1}>Insights</Title>
      {summary.isError && (
        <SectionError message={summary.error.message} retry={() => void summary.refetch()} />
      )}
      {!summary.data && !summary.isError && <Skeleton height={160} />}
      {summary.data && (
        <>
          <Cards summary={summary.data} canDrillDown={canDrillDown} />
          <PayrollByCountry summary={summary.data} />
        </>
      )}
      <Distribution />
    </Stack>
  );
}

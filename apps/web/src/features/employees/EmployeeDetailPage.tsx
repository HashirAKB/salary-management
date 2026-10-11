import {
  employeeDetailSchema,
  salaryHistoryResponseSchema,
  type EmployeeDetail,
} from '@acme/shared';
import { Alert, Badge, Button, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError, apiFetch } from '../../api/client.ts';
import { Money } from '../../components/Money.tsx';
import { useViewer } from '../../components/Shell.tsx';
import { formatCompaRatio, formatDate } from '../../format.ts';
import { EditEmployeeModal } from './EditEmployeeModal.tsx';
import { SalaryChangeModal } from './SalaryChangeModal.tsx';
import { SalaryHistoryTable } from './SalaryHistoryTable.tsx';
import { TerminateModal } from './TerminateModal.tsx';

const BAND_TEXT = { below: 'Below band', above: 'Above band' } as const;
const GENDERS = {
  female: 'Female',
  male: 'Male',
  non_binary: 'Non-binary',
  not_disclosed: 'Not disclosed',
} as const;

function Card({ title, children }: { title: string; children: ReactElement | ReactElement[] }) {
  const id = `card-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <Paper component="section" aria-labelledby={id} withBorder p="md">
      <Stack>
        <Title order={2} size="h4" id={id}>
          {title}
        </Title>
        {children}
      </Stack>
    </Paper>
  );
}

function Field({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text>{value}</Text>
    </div>
  );
}

function SalaryCard({ employee }: { employee: EmployeeDetail }): ReactElement {
  const { band, bandPosition } = employee;
  return (
    <Card title="Salary">
      <Group align="baseline">
        <Money value={employee.salary} size="xl" fw={600} />
        <Money value={employee.salaryUsd} c="dimmed" />
      </Group>
      <Text size="sm">{`Effective ${formatDate(employee.salaryEffectiveDate)}`}</Text>
      <Group role="group" aria-label="Pay band" justify="space-between">
        {(['min', 'mid', 'max'] as const).map((point) => (
          <div key={point}>
            <Text size="xs" c="dimmed" tt="capitalize">
              {point}
            </Text>
            <Money value={band[point]} />
          </div>
        ))}
      </Group>
      <Group>
        <Text>{`Compa-ratio ${formatCompaRatio(employee.compaRatio)}`}</Text>
        {bandPosition !== 'inside' && (
          <Badge color={bandPosition === 'below' ? 'orange' : 'blue'} variant="light">
            {BAND_TEXT[bandPosition]}
          </Badge>
        )}
      </Group>
    </Card>
  );
}

function DetailsCard({ employee }: { employee: EmployeeDetail }): ReactElement {
  return (
    <Card title="Details">
      <Field label="First name" value={employee.firstName} />
      <Field label="Last name" value={employee.lastName} />
      <Field label="Gender" value={GENDERS[employee.gender]} />
      <Field label="Country" value={employee.country.name} />
      <Field label="Department" value={employee.department.name} />
    </Card>
  );
}

/** S-3 (04 section 8.5): one employee, with actions for HR Admin. */
export function EmployeeDetailPage(): ReactElement {
  const me = useViewer();
  const { id } = useParams();
  const [modal, setModal] = useState<'edit' | 'terminate' | 'salary'>();
  const employee = useQuery({
    queryKey: ['employee', id],
    queryFn: () => apiFetch(`/api/employees/${id}`, { schema: employeeDetailSchema }),
  });

  const canReadSalary = me.permissions.includes('salary.read');
  const history = useQuery({
    queryKey: ['employee', id, 'salary-changes'],
    queryFn: () =>
      apiFetch(`/api/employees/${id}/salary-changes`, { schema: salaryHistoryResponseSchema }),
    enabled: canReadSalary,
  });

  if (employee.isError) {
    const notFound =
      employee.error instanceof ApiError && employee.error.code === 'EMPLOYEE_NOT_FOUND';
    return notFound ? (
      <Stack align="flex-start">
        <Text>Employee not found.</Text>
        <Button component={Link} to="/employees" variant="light">
          Back to employees
        </Button>
      </Stack>
    ) : (
      <Alert color="red">
        <Group justify="space-between">
          <Text>{employee.error.message}</Text>
          <Button variant="light" onClick={() => void employee.refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  if (!employee.data) {
    return (
      <Stack aria-label="Loading employee">
        <Skeleton height={32} width="40%" />
        <Skeleton height={160} />
        <Skeleton height={200} />
      </Stack>
    );
  }

  const data = employee.data;
  const terminated = data.status === 'terminated';
  const canWrite = me.permissions.includes('employee.write');
  const canWriteSalary = me.permissions.includes('salary.write') && !terminated;
  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group>
            <Title order={1}>{`${data.firstName} ${data.lastName}`}</Title>
            <Badge color={terminated ? 'gray' : 'green'} variant="light">
              {terminated ? 'Terminated' : 'Active'}
            </Badge>
          </Group>
          <Text c="dimmed">{data.employeeCode}</Text>
          <Text>{`${data.jobTitle.name}, ${data.level.code} ${data.level.name}, ${data.country.name}`}</Text>
          <Text>{`Hired ${formatDate(data.hireDate)}`}</Text>
        </Stack>
        {(canWrite || canWriteSalary) && (
          <Group>
            {canWriteSalary && (
              <Button onClick={() => setModal('salary')}>Record salary change</Button>
            )}
            <Button variant="default" onClick={() => setModal('edit')}>
              Edit details
            </Button>
            {!terminated && (
              <Button color="red" onClick={() => setModal('terminate')}>
                Terminate
              </Button>
            )}
          </Group>
        )}
      </Group>
      {terminated && data.terminationDate && (
        <Alert color="gray">
          {`Terminated on ${formatDate(data.terminationDate)}. Excluded from current insights. History is kept.`}
        </Alert>
      )}
      <SalaryCard employee={data} />
      {canReadSalary && history.data && (
        <Card title="Salary history">
          <SalaryHistoryTable items={history.data.items} />
        </Card>
      )}
      <DetailsCard employee={data} />
      {canWriteSalary && (
        <SalaryChangeModal
          employee={data}
          opened={modal === 'salary'}
          onClose={() => setModal(undefined)}
        />
      )}
      {canWrite && (
        <>
          <EditEmployeeModal
            employee={data}
            opened={modal === 'edit'}
            onClose={() => setModal(undefined)}
          />
          <TerminateModal
            employee={data}
            opened={modal === 'terminate'}
            onClose={() => setModal(undefined)}
          />
        </>
      )}
    </Stack>
  );
}

import {
  createEmployeeBodySchema,
  employeeDetailSchema,
  payBandResponseSchema,
  type CreateEmployeeBody,
} from '@acme/shared';
import { Alert, Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../../api/client.ts';
import { Money } from '../../components/Money.tsx';
import { useViewer } from '../../components/Shell.tsx';
import { formatCompaRatio, parseMajorToMinor } from '../../format.ts';
import { useReference } from './useReference.ts';

const FIELDS = [
  'firstName',
  'lastName',
  'gender',
  'countryCode',
  'jobTitleId',
  'levelCode',
  'hireDate',
  'startingSalary',
] as const;
type Field = (typeof FIELDS)[number];
type Errors = Partial<Record<Field, string>>;

type Values = Record<Field, string>;
const EMPTY: Values = Object.fromEntries(FIELDS.map((field) => [field, ''])) as Values;

const REQUIRED: Record<Field, string> = {
  firstName: 'Enter a first name.',
  lastName: 'Enter a last name.',
  gender: 'Choose a gender.',
  countryCode: 'Choose a country.',
  jobTitleId: 'Choose a job title.',
  levelCode: 'Choose a level.',
  hireDate: 'Enter a hire date.',
  startingSalary: 'Enter a starting salary.',
};

/** The form field an `errors[]` path belongs to; the salary's parts all show under the amount. */
function fieldOf(path: string): Field | undefined {
  const root = path.split('.')[0];
  return FIELDS.find((field) => field === root);
}

/** Server validation messages by field, plus the ones that match no field. */
function sortServerErrors(errors: { path: string; message: string }[]) {
  const byField: Errors = {};
  const unmatched: string[] = [];
  for (const { path, message } of errors) {
    const field = fieldOf(path);
    if (field) byField[field] ??= message;
    else unmatched.push(message);
  }
  return { byField, unmatched };
}

/** S-4 (04 section 8.5): add an employee. */
export function NewEmployeePage(): ReactElement {
  const me = useViewer();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const reference = useReference().data;
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const set = (field: Field) => (value: string | null) =>
    setValues((current) => ({ ...current, [field]: value ?? '' }));

  const currency = reference?.countries.find((c) => c.code === values.countryCode)?.currency;
  const amountMinor = parseMajorToMinor(values.startingSalary);
  const chosen = values.countryCode && values.jobTitleId && values.levelCode;
  const band = useQuery({
    queryKey: ['payBand', values.countryCode, values.jobTitleId, values.levelCode],
    queryFn: () =>
      apiFetch(`/api/pay-bands/${values.countryCode}/${values.jobTitleId}/${values.levelCode}`, {
        schema: payBandResponseSchema,
      }),
    enabled: Boolean(chosen),
  }).data;
  const outside =
    band && amountMinor !== null
      ? amountMinor < band.min.amountMinor
        ? 'This is below the band minimum.'
        : amountMinor > band.max.amountMinor
          ? 'This is above the band maximum.'
          : undefined
      : undefined;

  const create = useMutation({
    mutationFn: (body: CreateEmployeeBody) =>
      apiFetch('/api/employees', { method: 'POST', body, schema: employeeDetailSchema }),
    onSuccess: (employee) => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void navigate(`/employees/${employee.id}`, {
        state: { toast: `Employee ${employee.employeeCode} added.` },
      });
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return setFormErrors([error.message]);
      if (error.code === 'VALIDATION_FAILED') {
        const { byField, unmatched } = sortServerErrors(error.errors);
        setErrors(byField);
        setFormErrors(unmatched);
      } else if (error.code === 'NO_PAY_BAND') {
        setFormErrors(["There's no pay band for this country, job title and level."]);
      } else if (error.code === 'SALARY_CURRENCY_MISMATCH') {
        setErrors({ startingSalary: error.message });
      } else if (error.code === 'DATE_IN_FUTURE') {
        setErrors({ hireDate: error.message });
      } else {
        setFormErrors([error.message]);
      }
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormErrors([]);
    const missing: Errors = {};
    for (const field of FIELDS) if (!values[field].trim()) missing[field] = REQUIRED[field];
    if (Object.keys(missing).length > 0) return setErrors(missing);
    if (amountMinor === null || !currency)
      return setErrors({ startingSalary: 'Enter an amount like 20480.50.' });
    if (amountMinor <= 0)
      return setErrors({ startingSalary: 'Enter an amount greater than zero.' });

    const parsed = createEmployeeBodySchema.safeParse({
      firstName: values.firstName,
      lastName: values.lastName,
      gender: values.gender,
      countryCode: values.countryCode,
      jobTitleId: Number(values.jobTitleId),
      levelCode: values.levelCode,
      hireDate: values.hireDate,
      startingSalary: { amountMinor, currency },
    });
    if (!parsed.success) {
      const found: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = fieldOf(issue.path.join('.'));
        if (field) found[field] ??= issue.message;
      }
      return setErrors(found);
    }
    create.mutate(parsed.data);
  };

  const goBack = () =>
    void navigate(`/employees${(location.state as { from?: string } | null)?.from ?? ''}`);

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack maw={560}>
        <Title order={1}>Add employee</Title>
        {formErrors.length > 0 && (
          <Alert color="red">
            {formErrors.map((message) => (
              <Text key={message}>{message}</Text>
            ))}
          </Alert>
        )}
        <TextInput
          label="First name"
          value={values.firstName}
          onChange={(event) => set('firstName')(event.currentTarget.value)}
          error={errors.firstName}
        />
        <TextInput
          label="Last name"
          value={values.lastName}
          onChange={(event) => set('lastName')(event.currentTarget.value)}
          error={errors.lastName}
        />
        <Select
          label="Gender"
          data={reference?.genders.map((g) => ({ value: g.code, label: g.name })) ?? []}
          value={values.gender || null}
          onChange={set('gender')}
          error={errors.gender}
        />
        <Select
          label="Country"
          data={reference?.countries.map((c) => ({ value: c.code, label: c.name })) ?? []}
          value={values.countryCode || null}
          onChange={set('countryCode')}
          error={errors.countryCode}
        />
        <Select
          label="Job title"
          data={reference?.jobTitles.map((t) => ({ value: String(t.id), label: t.name })) ?? []}
          value={values.jobTitleId || null}
          onChange={set('jobTitleId')}
          error={errors.jobTitleId}
        />
        <Select
          label="Level"
          data={
            reference?.levels.map((l) => ({ value: l.code, label: `${l.code} ${l.name}` })) ?? []
          }
          value={values.levelCode || null}
          onChange={set('levelCode')}
          error={errors.levelCode}
        />
        <TextInput
          label="Hire date"
          type="date"
          max={me.today}
          value={values.hireDate}
          onChange={(event) => set('hireDate')(event.currentTarget.value)}
          error={errors.hireDate}
        />
        <TextInput
          label="Starting salary"
          value={values.startingSalary}
          onChange={(event) => set('startingSalary')(event.currentTarget.value)}
          rightSection={currency && <Text size="sm">{currency}</Text>}
          rightSectionWidth={56}
          error={errors.startingSalary}
        />
        {band && (
          <Stack gap="xs">
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
            {amountMinor !== null && (
              <Text>{`Compa-ratio ${formatCompaRatio(amountMinor / band.mid.amountMinor)}`}</Text>
            )}
            {outside && <Alert color="yellow">{outside}</Alert>}
          </Stack>
        )}
        <Group>
          <Button type="submit" loading={create.isPending}>
            Add employee
          </Button>
          <Button variant="default" onClick={goBack}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

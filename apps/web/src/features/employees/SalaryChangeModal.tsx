import {
  changePct,
  compaRatio,
  payBandResponseSchema,
  salaryChangeBodySchema,
  type EmployeeDetail,
  type SalaryChangeBody,
  type SalaryChangeReason,
} from '@acme/shared';
import { Alert, Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, apiFetch } from '../../api/client.ts';
import { Money } from '../../components/Money.tsx';
import { useViewer } from '../../components/Shell.tsx';
import { useToast } from '../../components/Toasts.tsx';
import { formatChangePct, formatCompaRatio, parseMajorToMinor } from '../../format.ts';
import { useReference } from './useReference.ts';

type Props = { employee: EmployeeDetail; opened: boolean; onClose: () => void };

const REASONS: { value: SalaryChangeReason; label: string }[] = [
  { value: 'promotion', label: 'Promotion' },
  { value: 'merit', label: 'Merit increase' },
  { value: 'market_adjustment', label: 'Market adjustment' },
  { value: 'correction', label: 'Correction' },
];

const FIELDS = ['effectiveDate', 'amount', 'jobTitleId', 'levelCode'] as const;
type Field = (typeof FIELDS)[number];
type Errors = Partial<Record<Field, string>>;

const fieldOf = (path: string): Field | undefined =>
  FIELDS.find((field) => field === path.split('.')[0]);

// 04 section 8.6: which rule codes show under which field; the rest show in the form alert.
const FIELD_OF_CODE: Record<string, Field> = {
  SALARY_CURRENCY_MISMATCH: 'amount',
  RAISE_REQUIRED: 'amount',
  SALARY_DATE_BEFORE_CURRENT: 'effectiveDate',
  DATE_IN_FUTURE: 'effectiveDate',
  POSITION_MUST_NOT_CHANGE: 'levelCode',
  PROMOTION_LEVEL_NOT_HIGHER: 'levelCode',
};

function Preview({
  employee,
  amountMinor,
  jobTitleId,
  levelCode,
}: {
  employee: EmployeeDetail;
  amountMinor: number;
  jobTitleId: string;
  levelCode: string;
}): ReactElement {
  const band = useQuery({
    queryKey: ['pay-band', employee.country.code, jobTitleId, levelCode],
    queryFn: () =>
      apiFetch(`/api/pay-bands/${employee.country.code}/${jobTitleId}/${levelCode}`, {
        schema: payBandResponseSchema,
      }),
    enabled: levelCode !== '',
    retry: false,
  });
  const { salary } = employee;
  const next = { amountMinor, currency: salary.currency };
  const bandData = band.data;
  const position = bandData
    ? amountMinor < bandData.min.amountMinor
      ? 'Below band'
      : amountMinor > bandData.max.amountMinor
        ? 'Above band'
        : 'Inside band'
    : undefined;
  return (
    <Stack gap={4} role="group" aria-label="Preview">
      <Text>
        <Money value={salary} />
        {' to '}
        <Money value={next} />
      </Text>
      <Text>{formatChangePct(changePct(salary.amountMinor, amountMinor))}</Text>
      {bandData && (
        <>
          <Text>{`New compa-ratio ${formatCompaRatio(compaRatio(amountMinor, bandData.mid.amountMinor))}`}</Text>
          <Text>{position}</Text>
        </>
      )}
    </Stack>
  );
}

function SalaryChangeForm({ employee, onClose }: Omit<Props, 'opened'>): ReactElement {
  const me = useViewer();
  const queryClient = useQueryClient();
  const toast = useToast();
  const reference = useReference().data;
  const currentTitleId = String(employee.jobTitle.id);
  const currentRank = reference?.levels.find((l) => l.code === employee.level.code)?.rank ?? 0;
  const [reason, setReason] = useState<SalaryChangeReason>('promotion');
  const [date, setDate] = useState(me.today);
  const [amount, setAmount] = useState('');
  const [jobTitleId, setJobTitleId] = useState(currentTitleId);
  const [levelCode, setLevelCode] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();

  const locked = reason === 'merit' || reason === 'market_adjustment';
  const levels = (reference?.levels ?? []).filter(
    (l) => reason !== 'promotion' || l.rank > currentRank,
  );
  const currency = employee.salary.currency;

  const record = useMutation({
    mutationFn: (body: SalaryChangeBody) =>
      apiFetch(`/api/employees/${employee.id}/salary-changes`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employee', String(employee.id)] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast('Salary change recorded.');
      onClose();
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return setFormError(error.message);
      if (error.code === 'EMPLOYEE_TERMINATED') {
        void queryClient.invalidateQueries({ queryKey: ['employee', String(employee.id)] });
        void queryClient.invalidateQueries({ queryKey: ['employees'] });
        toast(error.message);
        return onClose();
      }
      if (error.code === 'VALIDATION_FAILED') {
        const byField: Errors = {};
        const unmatched: string[] = [];
        for (const { path, message } of error.errors) {
          const field = fieldOf(path);
          if (field) byField[field] ??= message;
          else unmatched.push(message);
        }
        setErrors(byField);
        return setFormError(unmatched[0]);
      }
      const field = FIELD_OF_CODE[error.code];
      if (field) setErrors({ [field]: error.message });
      else setFormError(error.message);
    },
  });

  const changeReason = (value: string | null) => {
    const next = REASONS.find((r) => r.value === value)?.value;
    if (!next) return;
    setReason(next);
    if (next === 'merit' || next === 'market_adjustment') {
      setJobTitleId(currentTitleId);
      setLevelCode(employee.level.code);
    } else if (next === 'promotion') {
      setLevelCode('');
    } else if (levelCode === '') {
      setLevelCode(employee.level.code);
    }
  };

  const shownLevel = locked ? employee.level.code : levelCode;
  const previewMinor = parseMajorToMinor(amount);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(undefined);
    const amountMinor = parseMajorToMinor(amount);
    const found: Errors = {};
    if (amountMinor === null) found.amount = 'Enter the new annual salary.';
    else if (amountMinor <= 0) found.amount = 'Enter an amount greater than zero.';
    if (!shownLevel) found.levelCode = 'Choose a level.';
    if (Object.keys(found).length > 0) return setErrors(found);
    const parsed = salaryChangeBodySchema.safeParse({
      effectiveDate: date,
      reason,
      amount: { amountMinor, currency },
      jobTitleId: Number(jobTitleId),
      levelCode: shownLevel,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = fieldOf(issue.path.join('.'));
        if (field) found[field] ??= issue.message;
      }
      return setErrors(found);
    }
    record.mutate(parsed.data);
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack>
        {formError && <Alert color="red">{formError}</Alert>}
        <Select
          label="Reason"
          data={REASONS}
          value={reason}
          onChange={changeReason}
          allowDeselect={false}
        />
        <TextInput
          label="Effective date"
          type="date"
          value={date}
          min={employee.salaryEffectiveDate}
          max={me.today}
          onChange={(event) => setDate(event.currentTarget.value)}
          error={errors.effectiveDate}
        />
        <TextInput
          label="New annual salary"
          value={amount}
          onChange={(event) => setAmount(event.currentTarget.value)}
          rightSection={<Text size="sm">{currency}</Text>}
          rightSectionWidth={56}
          error={errors.amount}
        />
        <Select
          label="Job title"
          data={reference?.jobTitles.map((t) => ({ value: String(t.id), label: t.name })) ?? []}
          value={jobTitleId}
          onChange={(value) => setJobTitleId(value ?? currentTitleId)}
          disabled={locked}
          error={errors.jobTitleId}
          allowDeselect={false}
        />
        <Select
          label="Level"
          data={levels.map((l) => ({ value: l.code, label: `${l.code} ${l.name}` }))}
          value={shownLevel || null}
          onChange={(value) => setLevelCode(value ?? '')}
          disabled={locked}
          error={errors.levelCode}
          allowDeselect={false}
        />
        {previewMinor !== null && previewMinor > 0 && (
          <Preview
            employee={employee}
            amountMinor={previewMinor}
            jobTitleId={jobTitleId}
            levelCode={shownLevel}
          />
        )}
        <Group justify="flex-end">
          <Button type="submit" loading={record.isPending}>
            Record change
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** S-6 (04 section 8.5): record a raise, promotion or correction. */
export function SalaryChangeModal({ employee, opened, onClose }: Props): ReactElement {
  return (
    <Modal opened={opened} onClose={onClose} title="Record salary change">
      <SalaryChangeForm employee={employee} onClose={onClose} />
    </Modal>
  );
}

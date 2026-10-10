import { employeeDetailSchema, terminateBodySchema, type EmployeeDetail } from '@acme/shared';
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, apiFetch } from '../../api/client.ts';
import { useViewer } from '../../components/Shell.tsx';
import { useToast } from '../../components/Toasts.tsx';

type Props = { employee: EmployeeDetail; opened: boolean; onClose: () => void };

const DATE_CODES = ['VALIDATION_FAILED', 'DATE_IN_FUTURE', 'TERMINATION_BEFORE_HIRE'];

function TerminateForm({ employee, onClose }: Omit<Props, 'opened'>): ReactElement {
  const me = useViewer();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [date, setDate] = useState(me.today);
  const [dateError, setDateError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  const terminate = useMutation({
    mutationFn: (terminationDate: string) =>
      apiFetch(`/api/employees/${employee.id}/termination`, {
        method: 'POST',
        body: { terminationDate },
        schema: employeeDetailSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['employee', String(employee.id)], updated);
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && DATE_CODES.includes(error.code)) {
        setDateError(error.errors[0]?.message ?? error.message);
      } else if (error instanceof ApiError && error.code === 'EMPLOYEE_ALREADY_TERMINATED') {
        void queryClient.invalidateQueries({ queryKey: ['employee', String(employee.id)] });
        void queryClient.invalidateQueries({ queryKey: ['employees'] });
        toast(error.message);
        onClose();
      } else if (error instanceof ApiError && error.code === 'EMPLOYEE_NOT_FOUND') {
        void queryClient.invalidateQueries({ queryKey: ['employee', String(employee.id)] });
        onClose();
      } else {
        setFormError(error.message);
      }
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setDateError(undefined);
    setFormError(undefined);
    const parsed = terminateBodySchema.safeParse({ terminationDate: date });
    if (!parsed.success) return setDateError('Enter a termination date.');
    terminate.mutate(parsed.data.terminationDate);
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack>
        {formError && <Alert color="red">{formError}</Alert>}
        <Text>
          {`Terminating removes ${employee.firstName} ${employee.lastName} from current insights. Their record and salary history are kept. This can't be undone in this version.`}
        </Text>
        <TextInput
          label="Termination date"
          type="date"
          value={date}
          min={employee.hireDate}
          max={me.today}
          onChange={(event) => setDate(event.currentTarget.value)}
          error={dateError}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" color="red" loading={terminate.isPending}>
            Terminate
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** S-7 (04 section 8.5): end an employee's employment. */
export function TerminateModal({ employee, opened, onClose }: Props): ReactElement {
  return (
    <Modal opened={opened} onClose={onClose} title="Terminate employee">
      <TerminateForm employee={employee} onClose={onClose} />
    </Modal>
  );
}

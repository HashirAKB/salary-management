import {
  employeeDetailSchema,
  updateEmployeeBodySchema,
  type EmployeeDetail,
  type UpdateEmployeeBody,
} from '@acme/shared';
import { Alert, Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactElement } from 'react';
import { ApiError, apiFetch } from '../../api/client.ts';
import { useToast } from '../../components/Toasts.tsx';
import { useReference } from './useReference.ts';

const FIELDS = ['firstName', 'lastName', 'gender'] as const;
type Field = (typeof FIELDS)[number];
type Errors = Partial<Record<Field, string>>;

const fieldOf = (path: string): Field | undefined =>
  FIELDS.find((field) => field === path.split('.')[0]);

type Props = { employee: EmployeeDetail; opened: boolean; onClose: () => void };

function EditForm({ employee, onClose }: Omit<Props, 'opened'>): ReactElement {
  const queryClient = useQueryClient();
  const toast = useToast();
  const reference = useReference().data;
  const [values, setValues] = useState<Record<Field, string>>({
    firstName: employee.firstName,
    lastName: employee.lastName,
    gender: employee.gender,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();

  const changed = Object.fromEntries(
    FIELDS.filter((f) => values[f] !== employee[f]).map((f) => [f, values[f]]),
  );
  const dirty = Object.keys(changed).length > 0;

  const save = useMutation({
    mutationFn: (body: UpdateEmployeeBody) =>
      apiFetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        body,
        schema: employeeDetailSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['employee', String(employee.id)], updated);
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast('Details updated.');
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
        const byField: Errors = {};
        const unmatched: string[] = [];
        for (const { path, message } of error.errors) {
          const field = fieldOf(path);
          if (field) byField[field] ??= message;
          else unmatched.push(message);
        }
        setErrors(byField);
        setFormError(unmatched[0]);
      } else {
        setFormError(error.message);
      }
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(undefined);
    const parsed = updateEmployeeBodySchema.safeParse(changed);
    if (!parsed.success) {
      const found: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = fieldOf(issue.path.join('.'));
        if (field) found[field] ??= issue.message;
      }
      return setErrors(found);
    }
    save.mutate(parsed.data);
  };

  const set = (field: Field) => (value: string | null) =>
    setValues((current) => ({ ...current, [field]: value ?? '' }));

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack>
        {formError && <Alert color="red">{formError}</Alert>}
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
          value={values.gender}
          onChange={set('gender')}
          error={errors.gender}
          allowDeselect={false}
        />
        <TextInput label="Job title" value={employee.jobTitle.name} disabled readOnly />
        <TextInput
          label="Level"
          value={`${employee.level.code} ${employee.level.name}`}
          disabled
          readOnly
        />
        <TextInput label="Country" value={employee.country.name} disabled readOnly />
        <Text size="sm" c="dimmed">
          Change title or level by recording a salary change.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!dirty} loading={save.isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/** S-5 (04 section 8.5): name and gender; title, level and country are read-only. */
export function EditEmployeeModal({ employee, opened, onClose }: Props): ReactElement {
  return (
    <Modal opened={opened} onClose={onClose} title="Edit details">
      <EditForm employee={employee} onClose={onClose} />
    </Modal>
  );
}

import { meResponseSchema, type LoginBody, type MeResponse } from '@acme/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client.ts';

export const ME_KEY = ['me'];

/** Where a viewer lands after login and on `/` (04 section 8.1, D-046). */
export function landingPath(me: MeResponse): string {
  return me.permissions.includes('employee.read') ? '/employees' : '/insights';
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginBody) =>
      apiFetch('/api/auth/login', { method: 'POST', body, schema: meResponseSchema }),
    onSuccess: (me) => queryClient.setQueryData(ME_KEY, me),
  });
}

import { z } from 'zod';
import { isoDateSchema, roleSchema } from './common.ts';

// 04 section 4.5: every action a route can require.
export const actionSchema = z.enum([
  'reference.read',
  'employee.read',
  'employee.write',
  'salary.read',
  'salary.write',
  'export.employees',
  'insights.read',
  'ask.use',
]);

export type Action = z.infer<typeof actionSchema>;

// A2 (04 section 5.2).
export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(200),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

// A4 (04 section 5.2); also the body of a successful login.
export const meResponseSchema = z.object({
  user: z.object({
    id: z.number().int(),
    email: z.string(),
    displayName: z.string(),
    role: roleSchema,
  }),
  permissions: z.array(actionSchema),
  askEnabled: z.boolean(),
  today: isoDateSchema,
  fxAsOf: isoDateSchema,
});

export type MeResponse = z.infer<typeof meResponseSchema>;

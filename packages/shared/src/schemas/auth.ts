import { z } from 'zod';

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

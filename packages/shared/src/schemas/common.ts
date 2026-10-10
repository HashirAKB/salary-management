import { z } from 'zod';

// 04 section 4.7; values are the DB enums from 02 section 3.
export const roleSchema = z.enum(['hr_admin', 'hr_viewer', 'finance']);

export type Role = z.infer<typeof roleSchema>;

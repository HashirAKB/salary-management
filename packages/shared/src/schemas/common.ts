import { z } from 'zod';

// 04 section 4.7; values are the DB enums from 02 section 3.
export const roleSchema = z.enum(['hr_admin', 'hr_viewer', 'finance']);

export type Role = z.infer<typeof roleSchema>;

// 04 section 4.2: YYYY-MM-DD, no time zone.
export const isoDateSchema = z.iso.date();

export type IsoDate = z.infer<typeof isoDateSchema>;

// 04 section 4.7: trimmed, 1 to 100 characters, no leading formula character. The formula check
// runs on the raw value, so a leading tab is caught before trim removes it.
export const personNameSchema = z
  .string()
  .refine((value) => !/^\s*[=+\-@]|^[\t\r]/.test(value), {
    message: "Name can't start with =, +, -, @ or a tab.",
  })
  .trim()
  .min(1, 'Name is required.')
  .max(100, 'Name must be 100 characters or fewer.');

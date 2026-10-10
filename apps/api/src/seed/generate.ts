import type { employees, salaryChanges } from '../db/schema.ts';
import type { ReferenceData } from './reference.ts';

export const SEED = 20261011;
export const REF_DATE = '2026-09-30';

export type EmployeeRow = typeof employees.$inferInsert & { id: number };
export type SalaryChangeRow = typeof salaryChanges.$inferInsert & { id: number };

export type Dataset = ReferenceData & {
  employees: EmployeeRow[];
  salaryChanges: SalaryChangeRow[];
};

export type SeedConfig = {
  terminatedCount: number;
};

export const SEED_CONFIG: SeedConfig = { terminatedCount: 250 };

// generateDataset: pure, no DB, no clock, no env (02 section 7.1).
export function generateDataset(_config: SeedConfig, _seed: number, _refDate: string): Dataset {
  throw new Error('not implemented');
}

import type { Db } from '../db/client.ts';
import type { Role } from '../db/schema.ts';
import type { Dataset } from './generate.ts';

export type SeedUser = {
  email: string;
  displayName: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
};

export async function writeDataset(_db: Db, _dataset: Dataset, _users: SeedUser[]): Promise<void> {
  throw new Error('not implemented');
}

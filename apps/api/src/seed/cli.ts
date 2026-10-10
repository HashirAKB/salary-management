import type { Db } from '../db/client.ts';
import type { ScryptParams } from '../modules/auth/password.ts';

export type SeedDeps = {
  openDb: (url: string, authToken?: string) => Db;
  log: (line: string) => void;
  error: (line: string) => void;
  /** Defaults to the production cost. */
  scrypt?: ScryptParams;
};

// npm run seed: returns the process exit code.
export async function runSeed(
  _env: Record<string, string | undefined>,
  _deps: SeedDeps,
): Promise<number> {
  throw new Error('not implemented');
}

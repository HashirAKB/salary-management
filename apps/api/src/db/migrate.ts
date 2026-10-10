import type { Db } from './client.ts';

export async function migrate(_db: Db, _dir?: string): Promise<string[]> {
  throw new Error('not implemented');
}

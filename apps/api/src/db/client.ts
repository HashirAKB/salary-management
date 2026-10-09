import type { LibSQLDatabase } from 'drizzle-orm/libsql';

export type Db = LibSQLDatabase;

export function createDb(_url: string, _authToken?: string): Db {
  throw new Error('not implemented');
}

import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

export type Db = LibSQLDatabase & { $client: Client };

// One libSQL client for file:, :memory: and libsql:// URLs (ADR 0003).
export function createDb(url: string, authToken?: string): Db {
  return drizzle(createClient({ url, authToken }));
}

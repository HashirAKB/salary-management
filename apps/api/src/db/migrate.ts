import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './client.ts';

const defaultDir = fileURLToPath(new URL('./migrations', import.meta.url));

// Applies migrations/*.sql in filename order, each once, recorded in schema_migrations (ADR 0003).
// Returns the files applied by this run.
export async function migrate(db: Db, dir: string = defaultDir): Promise<string[]> {
  const client = db.$client;
  await client.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY) STRICT',
  );
  const done = new Set(
    (await client.execute('SELECT name FROM schema_migrations')).rows.map((row) =>
      String(row.name),
    ),
  );
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(join(dir, file), 'utf8');
    const tx = await client.transaction('write');
    try {
      await tx.executeMultiple(sql);
      await tx.execute({ sql: 'INSERT INTO schema_migrations (name) VALUES (?)', args: [file] });
      await tx.commit();
    } finally {
      tx.close();
    }
    applied.push(file);
  }
  return applied;
}

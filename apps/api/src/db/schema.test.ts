import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { createDb } from './client.ts';
import { migrate } from './migrate.ts';
import * as schema from './schema.ts';

type ColumnShape = { name: string; type: string; notNull: boolean; primaryKey: boolean };

const byName = (a: ColumnShape, b: ColumnShape) => a.name.localeCompare(b.name);

const drizzleTables = Object.values(schema as Record<string, unknown>).filter(
  (value): value is SQLiteTable => is(value, SQLiteTable),
);

function drizzleColumns(table: SQLiteTable): ColumnShape[] {
  const config = getTableConfig(table);
  const compositeKey = new Set(config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)));
  return config.columns
    .map((column) => {
      const primaryKey = column.primary || compositeKey.has(column.name);
      return {
        name: column.name,
        type: column.getSQLType().toUpperCase(),
        // SQLite reports INTEGER PRIMARY KEY as nullable; key columns are compared by primaryKey only.
        notNull: primaryKey ? true : column.notNull,
        primaryKey,
      };
    })
    .sort(byName);
}

describe('db/schema.ts (drift guard, ADR 0003)', () => {
  it("every Drizzle table's columns equal PRAGMA table_info for that table", async () => {
    const db = createDb(':memory:');
    await migrate(db);
    const sqlTables = (
      await db.$client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations' ORDER BY name",
      )
    ).rows.map((row) => String(row.name));

    expect(drizzleTables.map((table) => getTableConfig(table).name).sort()).toEqual(sqlTables);
    for (const table of drizzleTables) {
      const name = getTableConfig(table).name;
      const info = await db.$client.execute(`PRAGMA table_info(${name})`);
      const sqlColumns = info.rows
        .map((row) => {
          const primaryKey = Number(row.pk) > 0;
          return {
            name: String(row.name),
            type: String(row.type).toUpperCase(),
            notNull: primaryKey ? true : Number(row.notnull) === 1,
            primaryKey,
          };
        })
        .sort(byName);
      expect({ table: name, columns: drizzleColumns(table) }).toEqual({
        table: name,
        columns: sqlColumns,
      });
    }
  });
});

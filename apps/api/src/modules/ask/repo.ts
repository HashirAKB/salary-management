import type { AskReference } from '@acme/shared';
import { and, asc, count, eq, gte, inArray, lt } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { askLog, countries, departments, jobTitles, levels } from '../../db/schema.ts';
import { GENDERS } from '../../domain/genders.ts';

export type AskLogEntry = typeof askLog.$inferInsert;

export async function insertAskLog(db: Db, entry: Omit<AskLogEntry, 'id'>): Promise<void> {
  await db.insert(askLog).values(entry);
}

// The reference data the interpreter and the answer templates need (04 section 7.2).
export async function loadAskReference(db: Db): Promise<AskReference> {
  const [countryRows, departmentRows, jobTitleRows, levelRows] = await Promise.all([
    db
      .select({ code: countries.code, name: countries.name })
      .from(countries)
      .orderBy(asc(countries.name)),
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .orderBy(asc(departments.name)),
    db
      .select({ id: jobTitles.id, name: jobTitles.name })
      .from(jobTitles)
      .orderBy(asc(jobTitles.name)),
    db.select({ code: levels.code, name: levels.name }).from(levels).orderBy(asc(levels.rank)),
  ]);
  return {
    countries: countryRows,
    departments: departmentRows,
    jobTitles: jobTitleRows,
    levels: levelRows,
    genders: GENDERS.map((g) => ({ code: g.code, name: g.name })),
  };
}

// Questions that count toward the daily caps: rate_limited rows don't (04 section 5.8 step 2).
export async function countAsked(
  db: Db,
  window: { from: string; to: string },
  userId?: number,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(askLog)
    .where(
      and(
        inArray(askLog.outcome, ['answered', 'cannot_answer', 'error']),
        gte(askLog.askedAt, window.from),
        lt(askLog.askedAt, window.to),
        userId === undefined ? undefined : eq(askLog.userId, userId),
      ),
    );
  return row?.n ?? 0;
}

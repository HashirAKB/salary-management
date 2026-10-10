import { and, eq, gt } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { fxRates, sessions, users } from '../../db/schema.ts';

export type Session = typeof sessions.$inferInsert;
export type UserRow = typeof users.$inferSelect;

export async function insertSession(db: Db, session: Session): Promise<void> {
  await db.insert(sessions).values(session);
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

/** The FX rates' as-of date, shown next to every USD figure. */
export async function fxAsOf(db: Db): Promise<string> {
  const [row] = await db.select({ asOf: fxRates.asOfDate }).from(fxRates).limit(1);
  return row?.asOf ?? '';
}

/**
 * The user of an unexpired session: one primary-key lookup (04 section 4.3). Expiry is absolute
 * (ADR 0006); an expired row is treated as missing.
 */
export async function findSessionUser(
  db: Db,
  tokenHash: string,
  now: Date,
): Promise<UserRow | undefined> {
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now.toISOString())));
  return row?.user;
}

export async function deleteSession(db: Db, tokenHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

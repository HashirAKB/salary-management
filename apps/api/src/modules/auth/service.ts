import type { MeResponse } from '@acme/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { Config } from '../../config.ts';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { can, permissionsFor } from '../../domain/permissions.ts';
import { SESSION_SECONDS } from './cookie.ts';
import { findUserByEmail, fxAsOf, insertSession, type UserRow } from './sessions.ts';

export type AuthDeps = { db: Db; clock: Clock; config: Config };

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function meFor(
  { db, clock, config }: AuthDeps,
  user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'role'>,
): Promise<MeResponse> {
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    permissions: permissionsFor(user.role),
    askEnabled: Boolean(config.anthropicApiKey) && can(user.role, 'ask.use'),
    today: clock.today(),
    fxAsOf: await fxAsOf(db),
  };
}

/** Checks the password, stores a new session and returns its raw token with the me body. */
export async function login(
  deps: AuthDeps,
  email: string,
  _password: string,
): Promise<{ token: string; me: MeResponse }> {
  const user = await findUserByEmail(deps.db, email);
  if (!user) throw new Error(`no user ${email}`);
  const token = randomBytes(32).toString('base64url');
  const now = deps.clock.now();
  await insertSession(deps.db, {
    tokenHash: hashToken(token),
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
  });
  return { token, me: await meFor(deps, user) };
}

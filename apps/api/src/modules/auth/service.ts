import type { MeResponse } from '@acme/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { Config } from '../../config.ts';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { can, permissionsFor } from '../../domain/permissions.ts';
import { AppError } from '../../http/problem.ts';
import { SESSION_SECONDS } from './cookie.ts';
import { hashPassword, verifyPassword, type ScryptParams } from './password.ts';
import { findUserByEmail, fxAsOf, insertSession, type UserRow } from './sessions.ts';

export type AuthDeps = { db: Db; clock: Clock; config: Config };

// An unknown email is still compared against a hash of the configured cost, so timing doesn't
// reveal which emails exist (04 A2). One dummy hash per cost, made on first use.
const dummyHashes = new Map<string, Promise<string>>();
function dummyHash(params: ScryptParams): Promise<string> {
  const key = `${params.N}$${params.r}$${params.p}`;
  let hash = dummyHashes.get(key);
  if (!hash) {
    hash = hashPassword(randomBytes(16).toString('base64'), params);
    dummyHashes.set(key, hash);
  }
  return hash;
}

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
  password: string,
): Promise<{ token: string; me: MeResponse }> {
  const user = await findUserByEmail(deps.db, email);
  const matches = await verifyPassword(
    password,
    user?.passwordHash ?? (await dummyHash(deps.config.scrypt)),
  );
  if (!user || !matches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
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

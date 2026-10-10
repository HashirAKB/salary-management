import { createHash } from 'node:crypto';
import type { Role } from '@acme/shared';
import { sessions, users } from '../../src/db/schema.ts';
import { hashPassword } from '../../src/modules/auth/password.ts';
import { testConfig } from '../helpers.ts';
import { nextId, type DbOrTx } from './db.ts';

export type InsertedUser = {
  id: number;
  email: string;
  password: string;
  displayName: string;
  role: Role;
};

const DISPLAY_NAMES: Record<Role, string> = {
  hr_admin: 'HR Admin (test)',
  hr_viewer: 'HR Viewer (test)',
  finance: 'Finance (test)',
};

/** Email `<role>@test.local`, password `test-password-123` hashed at test cost (05 section 4.2). */
class UserBuilder {
  readonly #role: Role;
  #email: string;
  #password = 'test-password-123';

  constructor(role: Role) {
    this.#role = role;
    this.#email = `${role}@test.local`;
  }

  withEmail(email: string): this {
    this.#email = email;
    return this;
  }
  withPassword(password: string): this {
    this.#password = password;
    return this;
  }

  async insert(db: DbOrTx): Promise<InsertedUser> {
    const id = await nextId(db, 'users');
    const user = {
      id,
      email: this.#email,
      displayName: DISPLAY_NAMES[this.#role],
      role: this.#role,
    };
    await db.insert(users).values({
      ...user,
      passwordHash: await hashPassword(this.#password, testConfig.scrypt),
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    return { ...user, password: this.#password };
  }
}

export const aUser = (role: Role) => new UserBuilder(role);

/** Inserts a session row for an existing user and returns its cookie header. */
export async function aSessionFor(
  db: DbOrTx,
  userId: number,
  { createdAt = '2026-10-09T09:00:00.000Z' }: { createdAt?: string } = {},
): Promise<string> {
  const [row] = await db.all<{ n: number }>('SELECT count(*) + 1 AS n FROM sessions');
  const token = `test-token-${row?.n ?? 1}`;
  const created = new Date(createdAt);
  await db.insert(sessions).values({
    tokenHash: createHash('sha256').update(token).digest('hex'),
    userId,
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + 8 * 60 * 60 * 1000).toISOString(),
  });
  return `sid=${token}`;
}

/**
 * Inserts a user and a session row directly and returns the cookie header, so only login tests
 * pay for hashing (05 section 4.2). The session starts at the test clock's default instant.
 */
export async function loggedInAs(
  db: DbOrTx,
  role: Role,
  options: { createdAt?: string } = {},
): Promise<{ cookie: string; user: InsertedUser }> {
  const user = await aUser(role).insert(db);
  return { cookie: await aSessionFor(db, user.id, options), user };
}

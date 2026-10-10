import { describe, expect, it } from 'vitest';
import { hashPassword, PRODUCTION_SCRYPT, verifyPassword } from './password.ts';

// Tests use N=2^10 to stay fast (03 section 7); one test checks the production default.
const TEST_SCRYPT = { N: 1024, r: 8, p: 3 };

describe('password hashing (ADR 0006)', () => {
  it('password hashing round-trips, and a wrong password fails the comparison', async () => {
    const stored = await hashPassword('correct horse battery', TEST_SCRYPT);
    const again = await hashPassword('correct horse battery', TEST_SCRYPT);

    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batterz', stored)).toBe(false);
    expect(stored).toMatch(/^scrypt\$1024\$8\$3\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(again).not.toBe(stored);
  });

  it('the production hash string uses scrypt$32768$8$3$', async () => {
    const stored = await hashPassword('demo-password-123', PRODUCTION_SCRYPT);
    const [, , , , salt] = stored.split('$');

    expect(stored.startsWith('scrypt$32768$8$3$')).toBe(true);
    expect(Buffer.from(salt ?? '', 'base64')).toHaveLength(16);
    expect(await verifyPassword('demo-password-123', stored)).toBe(true);
  });
});
